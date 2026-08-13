// 카카오모빌리티 길찾기 API 클라이언트
//
// ── 이 파일의 책임 범위 ──────────────────────────────────────────────
// 호출과 응답 해석까지만 한다. 캐시·폴백·정책은 travelTimeService 의 몫이다.
//
// 엔드포인트: GET https://apis-navi.kakaomobility.com/v1/directions
// 인증: 헤더 Authorization: KakaoAK {REST_API_KEY}
// 좌표: origin/destination 은 "경도,위도" 순서다. 뒤집으면 조용히 엉뚱한 경로가 나온다.
//
// 무료 쿼터: 자동차 길찾기 1만 건/일 (리서치 2회 일치)

const BASE_URL =
  process.env.KAKAO_NAVI_BASE_URL || "https://apis-navi.kakaomobility.com";

const DEFAULT_TIMEOUT_MS = Number(process.env.KAKAO_NAVI_TIMEOUT_MS || 6000);

// 카카오 길찾기 result_code. 0 이 성공.
// 104(너무 가까움)는 "실패"가 아니라 "거리 0에 가깝다"는 뜻이라 따로 다뤄야 한다.
// 나머지 코드는 실호출로 검증 필요.
const RESULT_CODE = {
  OK: 0,
  NO_ROUTE: 1, // 길찾기 결과를 찾을 수 없음
  NO_ROAD_NEAR_ORIGIN: 102,
  NO_ROAD_NEAR_DESTINATION: 103,
  TOO_CLOSE: 104, // 출발지와 도착지가 너무 가까움
  ORIGIN_OUT_OF_SERVICE: 105,
  DESTINATION_OUT_OF_SERVICE: 106,
};

class KakaoRouteError extends Error {
  /**
   * @param {string} kind
   *   "no_key"   — 키 미설정. mock/개발 환경의 정상 상태이므로 폴백해도 됨
   *   "auth"     — 키가 있는데 거부됨(401/403). 설정 오류이므로 폴백으로 덮지 않음
   *   "quota"    — 쿼터 소진(429). 오늘은 더 못 씀
   *   "timeout"  — 응답 없음. 재시도 여지 있음
   *   "network"  — 연결 실패. 재시도 여지 있음
   *   "server"   — 5xx. 재시도 여지 있음
   *   "no_route" — 경로 없음. 재시도해도 같음
   *   "too_close"— 출발/도착이 너무 가까움. 이동시간 0 으로 처리 가능
   *   "api"      — 그 외 응답 오류
   */
  constructor(message, { kind = "api", code = null, status = null } = {}) {
    super(message);
    this.name = "KakaoRouteError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }

  // 다시 호출해볼 가치가 있는가
  get retryable() {
    return ["timeout", "network", "server"].includes(this.kind);
  }

  // 폴백(하버사인 근사)으로 넘어가야 하는가.
  // 키를 넣었는데 거부당한 경우(auth)만 제외한다. 폴백으로 덮어버리면
  // 설정이 틀렸다는 걸 영영 못 알아채고 계속 근사치로 돌게 된다.
  // 키를 아예 안 넣은 상태(no_key)는 mock 개발 중의 정상 상태이므로 폴백한다.
  get shouldFallback() {
    return this.kind !== "auth";
  }
}

function hasKakaoKey() {
  return Boolean(process.env.KAKAO_REST_KEY);
}

/**
 * 카카오 길찾기 응답에서 거리·시간을 뽑는다.
 * 실제 응답으로 검증 가능하도록 별도 함수로 뺀다.
 *
 * @returns {{ distance_m:number, duration_sec:number, toll:number, taxi_fare:number, source:"kakao" }}
 */
function parseRouteResponse(json) {
  const route = json?.routes?.[0];
  if (!route) {
    throw new KakaoRouteError("카카오 응답에 routes 가 없음", { kind: "api" });
  }

  const code = Number(route.result_code);

  if (code === RESULT_CODE.TOO_CLOSE) {
    throw new KakaoRouteError(
      `출발지와 도착지가 너무 가까움 [${code}] ${route.result_msg || ""}`,
      { kind: "too_close", code }
    );
  }

  if (code !== RESULT_CODE.OK) {
    throw new KakaoRouteError(
      `카카오 길찾기 실패 [${code}] ${route.result_msg || ""}`,
      { kind: "no_route", code }
    );
  }

  const summary = route.summary;
  const distance = Number(summary?.distance);
  const duration = Number(summary?.duration);

  if (!Number.isFinite(distance) || !Number.isFinite(duration)) {
    throw new KakaoRouteError("카카오 응답에 distance/duration 이 없음", {
      kind: "api",
      code,
    });
  }

  return {
    distance_m: distance,
    duration_sec: duration, // 초 단위. 분 변환은 travelTimeService 가 한다.
    toll: Number(summary?.fare?.toll ?? 0),
    taxi_fare: Number(summary?.fare?.taxi ?? 0),
    source: "kakao",
  };
}

/**
 * 두 좌표 사이의 자동차 경로를 조회한다.
 *
 * @param {{lat:number, lon:number}} origin
 * @param {{lat:number, lon:number}} destination
 * @param {{priority?:string, timeoutMs?:number}} options
 * @returns {Promise<{distance_m:number, duration_sec:number, toll:number, taxi_fare:number, source:"kakao"}>}
 * @throws {KakaoRouteError}
 */
async function getDrivingRoute(origin, destination, options = {}) {
  if (!hasKakaoKey()) {
    throw new KakaoRouteError("KAKAO_REST_KEY 가 설정되지 않음", {
      kind: "no_key",
    });
  }
  if (
    !Number.isFinite(origin?.lat) || !Number.isFinite(origin?.lon) ||
    !Number.isFinite(destination?.lat) || !Number.isFinite(destination?.lon)
  ) {
    throw new KakaoRouteError("좌표가 올바르지 않음", { kind: "api" });
  }

  const { priority = "RECOMMEND", timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // 경도,위도 순서
  const search = new URLSearchParams({
    origin: `${origin.lon},${origin.lat}`,
    destination: `${destination.lon},${destination.lat}`,
    priority,
    alternatives: "false",
    road_details: "false",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}/v1/directions?${search.toString()}`, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
      signal: controller.signal,
    });
  } catch (err) {
    const kind = err.name === "AbortError" ? "timeout" : "network";
    throw new KakaoRouteError(`카카오 길찾기 요청 실패: ${err.message}`, { kind });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new KakaoRouteError(`카카오 인증 실패 (${res.status})`, {
      kind: "auth",
      status: res.status,
    });
  }
  if (res.status === 429) {
    throw new KakaoRouteError("카카오 길찾기 쿼터 소진 (429)", {
      kind: "quota",
      status: res.status,
    });
  }
  if (res.status >= 500) {
    throw new KakaoRouteError(`카카오 서버 오류 (${res.status})`, {
      kind: "server",
      status: res.status,
    });
  }
  if (!res.ok) {
    throw new KakaoRouteError(`카카오 길찾기 오류 (${res.status})`, {
      kind: "api",
      status: res.status,
    });
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new KakaoRouteError(`카카오 응답 파싱 실패: ${err.message}`, {
      kind: "api",
    });
  }

  return parseRouteResponse(json);
}

module.exports = {
  getDrivingRoute,
  parseRouteResponse,
  hasKakaoKey,
  KakaoRouteError,
  RESULT_CODE,
};
