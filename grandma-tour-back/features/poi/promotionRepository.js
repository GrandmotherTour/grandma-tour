// 거점 승격 — 설문v1 이 뽑은 조합을 설문v2(CP-SAT)가 읽는 테이블로 넘긴다.
//
// ── 무엇을 하는가 ────────────────────────────────────────────────
//   poi_hub_combinations (후보 + 근거)  →  regions / guides / points / point_keywords
//                                          + travel_time_cache
// 관리자가 조합 하나를 "확정" 할 때만 호출된다. 파이프라인 실행과 다르다 —
// 실행은 후보를 쌓고, 승격은 그중 하나를 운영 대상으로 올린다.
//
// ── candidateRepository.js 와 다른 파일인 이유 ───────────────────
// candidateRepository 는 파이프라인 산출물을 **별도 테이블에** 남긴다.
// 이 파일은 그 산출물을 **기존 운영 테이블로** 옮긴다. 방향이 반대다.
// 또한 origin/feature/poi-commit 에 같은 일을 하는 repository.js 가 있어
// 파일명을 겹치지 않게 둔다 — 그 브랜치가 머지돼도 이 파일은 충돌하지 않는다.
//
// ── 지키는 원칙 ──────────────────────────────────────────────────
// 1. 값을 지어내지 않는다. 운영시간을 못 읽었으면 NULL 로 넣는다.
//    (poi-commit 의 repository.js 는 09:00~18:00 을 채워 넣는다 — 근거 없는 값이다)
// 2. 멱등성은 이름이 아니라 자연키로 잡는다.
//    지역은 (area_code, sigungu_code), POI 는 (region_id, content_id).
// 3. 억지로 매핑하지 않는다. preference_category 가 없는 POI 는 키워드 0개로 둔다.

const path = require("path");
const travelTime = require("./travelTimeService");

// pool 을 지연 로딩한다. DB 없이(미리보기만) 이 모듈을 import 할 수 있어야 한다.
let pool = null;
function getPool() {
  if (pool === null) {
    // eslint-disable-next-line global-require
    pool = require("../../config/db");
  }
  return pool;
}

const MIGRATION_PATH = path.join(__dirname, "..", "..", "..", "database", "migrations");

// CP-SAT 이 이동시간을 조회할 때 쓰는 값.
// travelTimeService 의 기본값은 "car" 라 명시하지 않으면 캐시가 서로 어긋난다.
// (features/recommendations/repository.js getTravelTimes 의 기본 인자와 맞춘 값)
const TRANSPORT_MODE = "taxi";

// ---------- 스키마 확인 ----------

/**
 * 003 마이그레이션이 적용됐는지 확인한다.
 * 조용히 실패하지 않는다 — 없으면 무엇을 실행해야 하는지 알려 준다.
 */
async function checkSchema() {
  const [columns] = await getPool().query(
    `SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND (
          (TABLE_NAME = 'regions' AND COLUMN_NAME IN ('area_code', 'sigungu_code'))
          OR (TABLE_NAME = 'points'
              AND COLUMN_NAME IN ('content_id', 'latitude', 'longitude', 'open_min', 'close_min'))
        )`
  );

  const present = new Set(columns.map((c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`));
  const missing = [
    "regions.area_code",
    "regions.sigungu_code",
    "points.content_id",
    "points.latitude",
    "points.longitude",
  ].filter((c) => !present.has(c));

  // 컬럼이 있어도 NOT NULL 이면 운영시간 unknown 을 표현할 수 없다.
  // 그 상태로 승격하면 폴백을 넣을 수밖에 없으므로 미적용으로 본다.
  const notNullable = columns
    .filter(
      (c) =>
        c.TABLE_NAME === "points" &&
        ["open_min", "close_min"].includes(c.COLUMN_NAME) &&
        c.IS_NULLABLE === "NO"
    )
    .map((c) => `points.${c.COLUMN_NAME}(NOT NULL)`);

  const problems = [...missing, ...notNullable];
  return {
    ready: problems.length === 0,
    missing: problems,
    hint:
      problems.length > 0
        ? `마이그레이션 미적용. ${path.join(MIGRATION_PATH, "003_hub_promotion.sql")} 를 실행하세요.`
        : null,
  };
}

// ---------- 조합 로드 ----------

/**
 * 승격 대상 조합과 그 멤버 POI 를 읽는다.
 * candidateRepository.getRunCombinations 와 달리 좌표·운영시간·분류까지 가져온다 —
 * points 로 넘기려면 원본 값이 전부 필요하다.
 */
async function loadCombination(runId, combinationId) {
  const [combos] = await getPool().query(
    `SELECT c.*, r.area_code, r.sigungu_code, r.sigungu_name,
            r.l_dong_regn_cd, r.l_dong_signgu_cd,
            r.source_mode, r.survey_source
       FROM poi_hub_combinations c
       JOIN poi_selection_runs r ON r.id = c.run_id
      WHERE c.id = ? AND c.run_id = ?`,
    [combinationId, runId]
  );
  if (combos.length === 0) return null;

  const [members] = await getPool().query(
    `SELECT p.content_id, p.title, p.latitude, p.longitude, p.address,
            p.image_url, p.description, p.preference_category, p.mapping_status,
            p.duration_min, p.open_windows, p.viability_status
       FROM poi_hub_combination_members m
       JOIN poi_candidates p ON p.id = m.candidate_id
      WHERE m.combination_id = ?
      ORDER BY p.id`,
    [combinationId]
  );

  return { combination: combos[0], members };
}

// ---------- upsert ----------

/**
 * 지역을 (area_code, sigungu_code) 기준으로 확보한다.
 * 이름 기준이 아니다 — v1 은 '청송군', v2 시드는 '경북 청송' 이라 이름은 맞지 않는다.
 */
async function ensureRegion(conn, { areaCode, sigunguCode, sigunguName, lDongRegnCd, lDongSignguCd }) {
  const [existing] = await conn.query(
    `SELECT id, name FROM regions WHERE area_code = ? AND sigungu_code = ? LIMIT 1`,
    [areaCode, sigunguCode]
  );
  if (existing.length > 0) {
     await conn.query(
        `UPDATE regions
        SET l_dong_regn_cd = ?, l_dong_signgu_cd = ?
        WHERE id = ?`,
      [
        lDongRegnCd ?? null,
        lDongSignguCd ?? null,
        existing[0].id,
      ]
    );
    return existing[0].id;
  }

  // 코드가 아직 안 붙었지만 이름이 같은 지역이 있으면 코드만 붙여 준다.
  // 새로 만들면 같은 지역이 두 행이 된다.
  const [byName] = await conn.query(
    `SELECT id FROM regions WHERE name = ? AND area_code IS NULL LIMIT 1`,
    [sigunguName]
  );
  if (byName.length > 0) {
    await conn.query(`UPDATE regions SET area_code = ?, sigungu_code = ?, l_dong_regn_cd = ?, l_dong_signgu_cd = ?
       WHERE id = ?`, 
       [
        areaCode,
        sigunguCode,
        lDongRegnCd ?? null,
        lDongSignguCd ?? null,
        byName[0].id,
    ]);
    return byName[0].id;
  }

  const [inserted] = await conn.query(
    `INSERT INTO regions (name, area_code, sigungu_code, l_dong_regn_cd, l_dong_signgu_cd, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sigunguName,
      areaCode,
      sigunguCode,
      lDongRegnCd ?? null,
      lDongSignguCd ?? null,
      `${sigunguName} 가이드 거점 (선정 파이프라인 승격)`,
    ]
  );
  return inserted.insertId;
}

/**
 * 거점마다 플레이스홀더 가이드를 만든다.
 *
 * 가이드 배치는 파이프라인 밖의 단계라 승격 시점에는 실제 가이드가 없다.
 * points.guide_id 가 NOT NULL 이므로 자리를 채우되, **이름에 (미배치)를 남겨
 * 화면에서 가짜임이 드러나게** 한다. 실제 배치가 되면 이 행을 갱신하면 된다.
 */
async function ensurePlaceholderGuide(conn, regionId, poiName) {
  const name = `${poiName} 상주 가이드(미배치)`;

  const [existing] = await conn.query(
    `SELECT id FROM guides WHERE region_id = ? AND name = ? LIMIT 1`,
    [regionId, name]
  );
  if (existing.length > 0) return existing[0].id;

  const [inserted] = await conn.query(
    `INSERT INTO guides (region_id, name, intro) VALUES (?, ?, ?)`,
    [regionId, name, "가이드 미배치 — 승격 시 자동 생성된 자리표시자"]
  );
  return inserted.insertId;
}

/**
 * open_windows(JSON) → open_min/close_min.
 *
 * 다중 구간을 스칼라로 줄이는 정책이 아직 미결이라 **첫 구간만** 쓴다.
 * 못 읽었으면 NULL 이다. 폴백을 넣지 않는다.
 *
 * @returns {{openMin: number|null, closeMin: number|null, known: boolean}}
 */
function toOpenCloseMin(openWindows) {
  let windows = openWindows;
  if (typeof windows === "string") {
    try {
      windows = JSON.parse(windows);
    } catch {
      windows = null;
    }
  }
  if (!Array.isArray(windows) || windows.length === 0) {
    return { openMin: null, closeMin: null, known: false };
  }

  const first = windows[0];
  if (!Number.isFinite(first?.start) || !Number.isFinite(first?.end)) {
    return { openMin: null, closeMin: null, known: false };
  }
  return { openMin: first.start, closeMin: first.end, known: true };
}

/** POI 하나를 points 에 올린다. 멱등 기준은 (region_id, content_id). */
async function upsertPoint(conn, regionId, guideId, poi) {
  const hours = toOpenCloseMin(poi.open_windows);
  // points 에 주소 컬럼이 없다. 설명이 없을 때만 주소로 대체한다.
  const description = poi.description || poi.address || null;

  await conn.query(
    `INSERT INTO points
       (region_id, guide_id, name, content_id, description, latitude, longitude,
        image_url, duration_min, open_min, close_min, reservation_required, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE)
     ON DUPLICATE KEY UPDATE
       guide_id = VALUES(guide_id),
       name = VALUES(name),
       description = VALUES(description),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       image_url = VALUES(image_url),
       duration_min = VALUES(duration_min),
       open_min = VALUES(open_min),
       close_min = VALUES(close_min),
       is_active = TRUE`,
    [
      regionId,
      guideId,
      poi.title,
      poi.content_id,
      description,
      poi.latitude ?? null,
      poi.longitude ?? null,
      poi.image_url ?? null,
      // duration 은 v1 이 항상 값을 준다(대부분 policy 추정값이며,
      // 그 사실은 poi_candidates.sources 에 남아 있다).
      poi.duration_min ?? 60,
      hours.openMin,
      hours.closeMin,
    ]
  );

  const [rows] = await conn.query(
    `SELECT id FROM points WHERE region_id = ? AND content_id = ? LIMIT 1`,
    [regionId, poi.content_id]
  );
  return { pointId: rows[0].id, hoursKnown: hours.known };
}

/**
 * preference_category → point_keywords.
 *
 * 002 마이그레이션으로 설문v1 카테고리와 keywords.name 이 같은 어휘가 됐다.
 * 그래서 변환표 없이 이름으로 바로 찾는다. 없는 카테고리는 **만들지 않는다** —
 * 어휘가 어긋났다는 신호이므로 조용히 새 키워드를 만들면 안 된다.
 *
 * @returns {Promise<boolean>} 키워드를 붙였는지
 */
async function linkKeyword(conn, pointId, preferenceCategory) {
  await conn.query(`DELETE FROM point_keywords WHERE point_id = ?`, [pointId]);
  if (!preferenceCategory) return false;

  const [rows] = await conn.query(
    `SELECT id FROM keywords WHERE name = ? AND type = 'preference' LIMIT 1`,
    [preferenceCategory]
  );
  if (rows.length === 0) return false;

  await conn.query(
    `INSERT IGNORE INTO point_keywords (point_id, keyword_id) VALUES (?, ?)`,
    [pointId, rows[0].id]
  );
  return true;
}

// ---------- 이동시간 ----------

/**
 * 승격된 거점 쌍의 이동시간을 travel_time_cache 에 채운다.
 *
 * travelTimeService.getTravelTime 이 캐시 읽기/쓰기·카카오 호출·근사 폴백을
 * 전부 처리하므로 그대로 쓴다. **mode 를 명시해야 한다** — 기본값이 "car" 라
 * CP-SAT 이 조회하는 "taxi" 와 어긋난다.
 *
 * 거점 4~5개면 방향쌍 12~20개다. 관측 문서 §6 이 다음 할 일로 적어 둔
 * "거점 확정 후 해당 구간 전수 실측" 이 정확히 이 지점이다.
 *
 * 트랜잭션 밖에서 실행한다 — 외부 API 호출이 길어 커넥션을 잡고 있으면 안 되고,
 * 캐시 저장은 실패해도 승격 자체를 되돌릴 이유가 없다.
 */
async function fillTravelTimes(points) {
  const routable = points.filter(
    (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
  );

  const bySource = {};
  let pairs = 0;
  const skippedNoCoords = points.length - routable.length;

  for (const from of routable) {
    for (const to of routable) {
      if (from.pointId === to.pointId) continue;
      try {
        const result = await travelTime.getTravelTime(
          { lat: Number(from.lat), lon: Number(from.lon), pointId: from.pointId },
          { lat: Number(to.lat), lon: Number(to.lon), pointId: to.pointId },
          { mode: TRANSPORT_MODE }
        );
        bySource[result.source] = (bySource[result.source] || 0) + 1;
        pairs += 1;
      } catch (err) {
        // 인증 오류 등 폴백으로 덮으면 안 되는 것만 여기 온다.
        // 승격은 이미 커밋됐으므로 되돌리지 않고 사실만 남긴다.
        console.warn(`[promotion] 이동시간 실패 ${from.pointId}→${to.pointId}:`, err.message);
        bySource.failed = (bySource.failed || 0) + 1;
      }
    }
  }

  return { pairs, bySource, skippedNoCoords };
}

// ---------- 승격 ----------

/**
 * 조합 하나를 운영 거점으로 승격한다.
 *
 * @param {{runId: number, combinationId: number}} params
 * @returns {Promise<object>} 무엇이 올라갔고 무엇이 비어 있는지
 */
async function promoteCombination({ runId, combinationId }) {
  const schema = await checkSchema();
  if (!schema.ready) {
    const error = new Error(`승격 불가 — 스키마 미적용: ${schema.missing.join(", ")}. ${schema.hint}`);
    error.code = "SCHEMA_NOT_READY";
    throw error;
  }

  const loaded = await loadCombination(runId, combinationId);
  if (!loaded) {
    const error = new Error(`조합을 찾을 수 없습니다: run ${runId} / combination ${combinationId}`);
    error.code = "COMBINATION_NOT_FOUND";
    throw error;
  }

  const { combination, members } = loaded;
  if (members.length === 0) {
    const error = new Error(`조합 ${combinationId} 에 멤버 POI 가 없습니다.`);
    error.code = "COMBINATION_EMPTY";
    throw error;
  }

  const conn = await getPool().getConnection();
  let regionId;
  let promoted = [];
  let deactivated = 0;
  let unmappedCount = 0;

  try {
    await conn.beginTransaction();

    regionId = await ensureRegion(conn, {
      areaCode: combination.area_code,
      sigunguCode: combination.sigungu_code,
      sigunguName: combination.sigungu_name,
      lDongRegnCd: combination.l_dong_regn_cd,
      lDongSignguCd: combination.l_dong_signgu_cd,
    });

    for (const poi of members) {
      const guideId = await ensurePlaceholderGuide(conn, regionId, poi.title);
      const { pointId, hoursKnown } = await upsertPoint(conn, regionId, guideId, poi);
      const linked = await linkKeyword(conn, pointId, poi.preference_category);
      if (!linked) unmappedCount += 1;

      promoted.push({
        pointId,
        guideId,
        contentId: poi.content_id,
        name: poi.title,
        hoursKnown,
        preferenceCategory: poi.preference_category,
        lat: poi.latitude,
        lon: poi.longitude,
      });
    }

    // 같은 지역의 나머지 거점은 비활성. 삭제가 아니라 되돌릴 수 있는 상태 변경이다.
    // 이렇게 하지 않으면 루트에 시드 샘플과 실제 거점이 섞여 구분되지 않는다.
    const promotedIds = promoted.map((p) => p.pointId);
    const [result] = await conn.query(
      `UPDATE points SET is_active = FALSE
        WHERE region_id = ? AND is_active = TRUE AND id NOT IN (?)`,
      [regionId, promotedIds]
    );
    deactivated = result.affectedRows;

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // 트랜잭션 밖. 외부 API 를 호출하므로 커넥션을 잡고 있지 않는다.
  const travel = await fillTravelTimes(promoted);

  return {
    runId,
    combinationId,
    regionId,
    region: {
      areaCode: combination.area_code,
      sigunguCode: combination.sigungu_code,
      sigunguName: combination.sigungu_name,
    },
    // 이 승격이 실측 기반인지 mock 기반인지. 반드시 따라가야 하는 값이다.
    sourceMode: combination.source_mode,
    surveySource: combination.survey_source,
    candidateSize: combination.candidate_size,
    needsReview: Boolean(combination.needs_review),
    points: promoted,
    deactivated,
    unmappedCount,
    hoursUnknownCount: promoted.filter((p) => !p.hoursKnown).length,
    travel,
  };
}

module.exports = {
  promoteCombination,
  checkSchema,
  loadCombination,
  toOpenCloseMin,
  TRANSPORT_MODE,
};
