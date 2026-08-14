// POI 간 이동시간 산출 — 캐시 → 카카오 → 폴백
//
// ── 왜 중요한가 ──────────────────────────────────────────────────
// 이 값은 부가정보가 아니다. CP-SAT 의 시간창 제약
//   start[j] >= start[i] + duration_i + travel_ij
// 에 직접 들어간다. 지금까지 travel_time_cache 를 아무도 채우지 않아
// recommender.py 가 모든 구간을 DEFAULT_TRAVEL_MIN=20 으로 폴백하고 있었다.
//
// ── 순서 ────────────────────────────────────────────────────────
//   1. DB 캐시 조회 (point_id 를 아는 경우에만)
//   2. 카카오모빌리티 길찾기
//   3. 실패 시에만 하버사인 × 40km/h 근사
//   → 어느 경로로 나온 값인지 source 로 반드시 구분한다.
//
// 40km/h 는 실측으로 확인한 값이다. 주왕산 → 청송군청 카카오 응답이
// 13,755m / 1,231초 = 40.2km/h 였다. (docs/poi-selection-spec.md STEP 10)

const kakaoRoute = require("./kakaoRouteClient");

// 폴백 계수: 40km/h = 1km 당 1.5분
const FALLBACK_KMH = Number(process.env.TRAVEL_FALLBACK_KMH || 40);
const FALLBACK_SOURCE = `fallback_${FALLBACK_KMH}kmh`;

// 도로는 직선이 아니다. 하버사인 직선거리에 곱해 실제 주행거리를 근사한다.
//
// 실측: 주왕산 → 청송군청 = 직선 9.22km / 카카오 실주행 13.755km → 1.49
// 산간 지형이라 우회가 크다. **표본이 1건뿐이므로 계속 보정해야 한다.**
// 1.5 로 잡은 것은 과소추정을 피하기 위해서다 — 이동시간을 짧게 잡으면
// CP-SAT 가 현실에서 지킬 수 없는 일정을 내놓는다. 오차는 넉넉한 쪽이 안전하다.
const ROAD_DETOUR_FACTOR = Number(process.env.TRAVEL_DETOUR_FACTOR || 1.5);

const DEFAULT_MODE = "car";

// 두 좌표 간 직선거리(km) — 하버사인
function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 초 → 분. 올림한다. 30초를 0분으로 깎으면 CP-SAT 가 불가능한 일정을 낼 수 있다.
function secondsToMinutes(sec) {
  return Math.max(1, Math.ceil(sec / 60));
}

/**
 * 하버사인 근사 폴백.
 * @returns {{travel_min:number, distance_m:number, source:string}}
 */
function estimateByDistance(from, to) {
  const straightKm = haversineKm(from.lat, from.lon, to.lat, to.lon);
  const roadKm = straightKm * ROAD_DETOUR_FACTOR;
  const minutes = Math.max(1, Math.ceil((roadKm / FALLBACK_KMH) * 60));

  return {
    travel_min: minutes,
    distance_m: Math.round(roadKm * 1000),
    source: FALLBACK_SOURCE,
  };
}

// ---------- DB 캐시 ----------
// pool 을 지연 로딩한다. DB 없이도(미리보기 단계) 이 모듈을 쓸 수 있어야 한다.
let pool = null;
function getPool() {
  if (pool === null) {
    // eslint-disable-next-line global-require
    pool = require("../../config/db");
  }
  return pool;
}

async function readCache(fromPointId, toPointId, mode) {
  try {
    const [rows] = await getPool().query(
      `SELECT travel_min, provider
         FROM travel_time_cache
        WHERE from_point_id = ? AND to_point_id = ? AND transport_mode = ?
        LIMIT 1`,
      [fromPointId, toPointId, mode]
    );
    if (rows.length === 0) return null;
    return {
      travel_min: Number(rows[0].travel_min),
      distance_m: null, // 현재 스키마에 거리 컬럼이 없다
      source: rows[0].provider || "cache",
      cached: true,
    };
  } catch (err) {
    console.warn("[travelTime] 캐시 조회 실패:", err.message);
    return null;
  }
}

async function writeCache(fromPointId, toPointId, mode, result) {
  try {
    await getPool().query(
      `INSERT INTO travel_time_cache
         (from_point_id, to_point_id, transport_mode, travel_min, provider)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         travel_min = VALUES(travel_min),
         provider = VALUES(provider),
         calculated_at = CURRENT_TIMESTAMP`,
      [fromPointId, toPointId, mode, result.travel_min, result.source]
    );
  } catch (err) {
    console.warn("[travelTime] 캐시 저장 실패:", err.message);
  }
}

/**
 * 두 지점 사이 이동시간(분)을 구한다.
 *
 * @param {{lat:number, lon:number, pointId?:number}} from
 * @param {{lat:number, lon:number, pointId?:number}} to
 * @param {{mode?:string, useCache?:boolean}} options
 * @returns {Promise<{travel_min:number, distance_m:number|null, source:string, cached?:boolean}>}
 *
 * source 는 "kakao" 또는 "fallback_40kmh" 로 반드시 구분된다.
 */
async function getTravelTime(from, to, options = {}) {
  const { mode = DEFAULT_MODE, useCache = true } = options;
  const canCache =
    useCache && from?.pointId != null && to?.pointId != null;

  // 1. 캐시
  if (canCache) {
    const hit = await readCache(from.pointId, to.pointId, mode);
    if (hit) return hit;
  }

  // 2. 카카오
  let result;
  try {
    const route = await kakaoRoute.getDrivingRoute(from, to);
    result = {
      travel_min: secondsToMinutes(route.duration_sec),
      distance_m: route.distance_m,
      source: "kakao",
    };
  } catch (err) {
    if (err instanceof kakaoRoute.KakaoRouteError) {
      // 너무 가까우면 이동시간 1분으로 본다(0 은 CP-SAT 에서 동시 방문이 된다).
      if (err.kind === "too_close") {
        result = { travel_min: 1, distance_m: 0, source: "kakao_too_close" };
      } else if (err.shouldFallback) {
        // 3. 폴백. 왜 폴백했는지 남긴다.
        console.warn(`[travelTime] 카카오 실패(${err.kind}) → 근사 사용:`, err.message);
        result = estimateByDistance(from, to);
      } else {
        // 인증 오류는 폴백으로 덮지 않는다. 설정을 고쳐야 하는 문제다.
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (canCache) await writeCache(from.pointId, to.pointId, mode, result);
  return result;
}

/**
 * POI 목록에 대해 방향쌍 전체의 이동시간 행렬을 만든다.
 * 왕복 방향이 다를 수 있으므로 (i,j) 와 (j,i) 를 각각 조회한다.
 *
 * 4~5개 POI 기준 최대 20 호출로, 카카오 일 1만 건 쿼터에 여유가 크다.
 *
 * @param {Array<{lat:number, lon:number, pointId?:number, name?:string}>} points
 * @returns {Promise<{matrix:Object, calls:number, bySource:Object}>}
 *   matrix[fromKey][toKey] = { travel_min, distance_m, source }
 */
async function buildTravelMatrix(points, options = {}) {
  const matrix = {};
  const bySource = {};
  let calls = 0;

  const keyOf = (p, i) => (p.pointId != null ? String(p.pointId) : `idx:${i}`);

  for (let i = 0; i < points.length; i += 1) {
    const from = points[i];
    const fromKey = keyOf(from, i);
    matrix[fromKey] = matrix[fromKey] || {};

    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const to = points[j];
      const toKey = keyOf(to, j);

      const result = await getTravelTime(from, to, options);
      matrix[fromKey][toKey] = result;

      calls += 1;
      bySource[result.source] = (bySource[result.source] || 0) + 1;
    }
  }

  return { matrix, calls, bySource };
}

module.exports = {
  getTravelTime,
  buildTravelMatrix,
  estimateByDistance,
  haversineKm,
  secondsToMinutes,
  FALLBACK_KMH,
  FALLBACK_SOURCE,
};
