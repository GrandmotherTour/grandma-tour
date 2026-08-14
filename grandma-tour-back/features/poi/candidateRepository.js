// 파이프라인 산출물 저장 — poi_selection_runs / poi_candidates / poi_hub_combinations
//
// ── 기존 repository.js 와 다른 파일인 이유 ───────────────────────
// feature/poi-commit 의 repository.js 는 확정 거점을 points 에 넣는다.
// 이 파일은 **후보와 근거**를 별도 테이블에 남긴다. 파일명을 나눠 두어야
// 두 브랜치를 병합할 때 충돌하지 않는다.
//
// ── 저장 원칙 ────────────────────────────────────────────────────
// 1. 값을 지어내지 않는다. 운영시간을 못 읽었으면 NULL 로 넣는다.
//    (기존 코드는 09:00~18:00 을 채워 넣고 있었다 — 근거 없는 값이다)
// 2. provenance 를 함께 넣는다. 특히 source_mode/survey_source 는
//    이 결과가 실측인지 mock 인지를 결정하므로 반드시 따라가야 한다.
// 3. 실행마다 새 run 을 쌓는다. 덮어쓰지 않는다 — 기준을 바꿔 가며
//    돌린 결과를 비교할 수 있어야 한다.

const path = require("path");

// pool 을 지연 로딩한다. DB 없이도(미리보기만) 이 모듈을 import 할 수 있어야 한다.
let pool = null;
function getPool() {
  if (pool === null) {
    // eslint-disable-next-line global-require
    pool = require("../../config/db");
  }
  return pool;
}

const MIGRATION_PATH = path.join(__dirname, "..", "..", "..", "database", "migrations");

// JSON 컬럼에 넣을 값. undefined 는 NULL 로.
function json(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/**
 * 마이그레이션이 적용됐는지 확인한다.
 * 없으면 무엇을 실행해야 하는지 알려 준다 — 조용히 실패하지 않는다.
 */
async function checkSchema() {
  const [rows] = await getPool().query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('poi_selection_runs','poi_candidates',
                           'poi_hub_combinations','poi_hub_combination_members')`
  );
  const present = new Set(rows.map((r) => r.TABLE_NAME));
  const missing = [
    "poi_selection_runs",
    "poi_candidates",
    "poi_hub_combinations",
    "poi_hub_combination_members",
  ].filter((t) => !present.has(t));

  return {
    ready: missing.length === 0,
    missing,
    hint:
      missing.length > 0
        ? `마이그레이션 미적용. ${path.join(MIGRATION_PATH, "001_poi_selection.sql")} 를 실행하세요.`
        : null,
  };
}

// ---------- 저장 ----------

async function insertRun(conn, result) {
  const clusterStep = result.steps.find((s) => s.id === "cluster");
  const metrics = clusterStep?.metrics || {};

  const [inserted] = await conn.query(
    `INSERT INTO poi_selection_runs
       (area_code, sigungu_code, sigungu_name,
        source_mode, source_mode_reason, survey_source,
        region_threshold_min, min_separation_min,
        conditions, api_calls, travel_distribution)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.region.areaCode,
      result.region.sigunguCode,
      result.region.sigunguName,
      result.sourceMode,
      result.sourceModeReason || null,
      result.steps.find((s) => s.id === "select")?.metrics?.surveySource || "mock",
      result.regionThresholdMin,
      result.conditions?.minSeparationMin || 0,
      json(result.conditions),
      json(result.apiCalls),
      json({
        pairCount: metrics.pairCount,
        minMin: metrics.minMin,
        p25Min: metrics.p25Min,
        medianMin: metrics.medianMin,
        p75Min: metrics.p75Min,
        maxMin: metrics.maxMin,
        byThreshold: metrics.byThreshold,
      }),
    ]
  );
  return inserted.insertId;
}

async function insertCandidates(conn, runId, result) {
  // content_id → DB id. 조합 멤버를 연결할 때 쓴다.
  const idByContentId = new Map();
  if (result.candidates.length === 0) return idByContentId;

  // POI 가 어느 권역에 속하는지
  const clusterByContentId = new Map();
  for (const region of result.regions || []) {
    for (const member of region.members) {
      clusterByContentId.set(member.content_id, region.rank);
    }
  }

  for (const poi of result.candidates) {
    const [inserted] = await conn.query(
      `INSERT INTO poi_candidates
         (run_id, content_id, content_type_id, title,
          latitude, longitude, address, tel, image_url, description,
          cat1, cat2, cat3, lcls_systm1, lcls_systm2, lcls_systm3,
          preference_category, mapping_status, classification_source, classification_code,
          poi_role, duration_min, open_windows, rest_days,
          viability_status, viability_reasons, accessibility, sources, cluster_rank)
       VALUES (?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?,?)`,
      [
        runId,
        poi.content_id,
        poi.content_type_id ?? null,
        poi.title,
        poi.latitude ?? null,
        poi.longitude ?? null,
        poi.address ?? null,
        poi.tel ?? null,
        poi.image_url ?? null,
        poi.description ?? null,
        poi.cat1 ?? null,
        poi.cat2 ?? null,
        poi.cat3 ?? null,
        poi.lcls_systm1 ?? null,
        poi.lcls_systm2 ?? null,
        poi.lcls_systm3 ?? null,
        poi.preference_category ?? null,
        poi.mapping_status ?? null,
        poi.classification_source ?? null,
        poi.classification_code ?? null,
        poi.poi_role ?? null,
        poi.duration_min ?? null,
        // 못 읽었으면 NULL. 폴백을 넣지 않는다.
        json(poi.open_windows),
        json(poi.rest_days),
        poi.viability?.status ?? null,
        json(poi.viability?.reasons),
        json(poi.accessibility),
        json(poi.sources),
        clusterByContentId.get(poi.content_id) ?? null,
      ]
    );
    idByContentId.set(poi.content_id, inserted.insertId);
  }

  return idByContentId;
}

async function insertCombinations(conn, runId, result, idByContentId) {
  let count = 0;

  for (const region of result.regionCandidates || []) {
    for (const bucket of [region.best_4_candidates, region.best_5_candidates]) {
      for (const combo of bucket.combinations || []) {
        const [inserted] = await conn.query(
          `INSERT INTO poi_hub_combinations
             (run_id, cluster_rank, candidate_size,
              category_coverage, demand_covered, category_distribution,
              max_pair_travel_min, min_pair_travel_min,
              mean_pair_travel_min, median_pair_travel_min,
              travel_provider_distribution, kakao_route_ratio,
              data_quality, needs_review, review_reasons, pareto_point)
           VALUES (?,?,?, ?,?,?, ?,?,?,?, ?,?, ?,?,?,?)`,
          [
            runId,
            region.cluster_id,
            combo.candidate_size,
            combo.category_coverage,
            combo.demand_covered ?? null,
            json(combo.category_distribution),
            combo.max_pair_travel_min ?? null,
            combo.min_pair_travel_min ?? null,
            combo.mean_pair_travel_min ?? null,
            combo.median_pair_travel_min ?? null,
            json(combo.travel_provider_distribution),
            combo.kakao_route_ratio ?? null,
            json(combo.data_quality),
            combo.needs_review ? 1 : 0,
            json(combo.review_reasons),
            json(combo.pareto_point),
          ]
        );

        for (const contentId of combo.poi_ids || []) {
          const candidateId = idByContentId.get(contentId);
          if (!candidateId) continue;
          await conn.query(
            `INSERT IGNORE INTO poi_hub_combination_members
               (combination_id, candidate_id) VALUES (?, ?)`,
            [inserted.insertId, candidateId]
          );
        }
        count += 1;
      }
    }
  }
  return count;
}

/**
 * 파이프라인 실행 결과를 통째로 저장한다.
 *
 * @param {object} result  runSelectionPipeline() 의 반환값 (내부 snake_case 형태)
 * @returns {Promise<{runId, candidates, combinations, sourceMode, surveySource}>}
 */
async function saveSelectionRun(result) {
  const schema = await checkSchema();
  if (!schema.ready) {
    const error = new Error(`저장 불가 — 테이블 없음: ${schema.missing.join(", ")}. ${schema.hint}`);
    error.code = "SCHEMA_NOT_READY";
    throw error;
  }

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const runId = await insertRun(conn, result);
    const idByContentId = await insertCandidates(conn, runId, result);
    const combinations = await insertCombinations(conn, runId, result, idByContentId);

    await conn.commit();

    return {
      runId,
      candidates: idByContentId.size,
      combinations,
      sourceMode: result.sourceMode,
      surveySource:
        result.steps.find((s) => s.id === "select")?.metrics?.surveySource || "mock",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- 조회 ----------

/** 지역별 최근 실행 목록. */
async function listRuns({ areaCode = null, sigunguCode = null, limit = 20 } = {}) {
  const where = [];
  const params = [];
  if (areaCode) {
    where.push("area_code = ?");
    params.push(areaCode);
  }
  if (sigunguCode) {
    where.push("sigungu_code = ?");
    params.push(sigunguCode);
  }
  params.push(Number(limit));

  const [rows] = await getPool().query(
    `SELECT id, area_code, sigungu_code, sigungu_name,
            source_mode, survey_source, region_threshold_min, min_separation_min,
            created_at
       FROM poi_selection_runs
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT ?`,
    params
  );
  return rows;
}

/** 실행 하나의 후보 조합 (멤버 POI 포함). */
async function getRunCombinations(runId) {
  const [combos] = await getPool().query(
    `SELECT * FROM poi_hub_combinations WHERE run_id = ?
      ORDER BY cluster_rank, candidate_size, demand_covered DESC, max_pair_travel_min`,
    [runId]
  );
  if (combos.length === 0) return [];

  const [members] = await getPool().query(
    `SELECT m.combination_id, c.content_id, c.title, c.preference_category,
            c.latitude, c.longitude, c.poi_role
       FROM poi_hub_combination_members m
       JOIN poi_candidates c ON c.id = m.candidate_id
      WHERE m.combination_id IN (?)`,
    [combos.map((c) => c.id)]
  );

  const byCombination = new Map();
  for (const member of members) {
    if (!byCombination.has(member.combination_id)) byCombination.set(member.combination_id, []);
    byCombination.get(member.combination_id).push(member);
  }

  return combos.map((combo) => ({ ...combo, members: byCombination.get(combo.id) || [] }));
}

module.exports = {
  saveSelectionRun,
  checkSchema,
  listRuns,
  getRunCombinations,
};
