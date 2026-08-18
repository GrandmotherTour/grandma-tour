// 설문 데이터 접근 — 설문v2(개인 설문) 저장/조회
//
// ── 설문v1 은 여기 없다 ──────────────────────────────────────────
// v1(집단 사전 설문)은 카테고리별 수요값 한 벌이라 행 단위 저장 대상이 아니고,
// features/poi/surveyPreference.js 가 소유한다. 이 파일은 v2 전용이다.

const pool = require("../../config/db");

// ---------- 키워드 (설문v2 문항) ----------

/**
 * 설문v2 문항으로 쓸 키워드 목록.
 * type 으로 나눠 준다 — preference 는 관광 선호(설문v1 과 같은 어휘),
 * environment 는 운영 조건이라 화면에서도 섞으면 안 된다.
 */
async function listKeywords() {
  const [rows] = await pool.query(
    `SELECT id, name, type FROM keywords ORDER BY type, id`
  );
  return rows;
}

/** 넘어온 키워드 id 중 실제로 존재하는 것들. 검증용. */
async function findExistingKeywordIds(ids) {
  if (!ids || ids.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT id FROM keywords WHERE id IN (?)`,
    [ids]
  );
  return rows.map((row) => row.id);
}

// ---------- 참조 무결성 확인 ----------
// preference_surveys.user_id / region_id 는 NOT NULL + FK 다.
// 없는 값을 넣으면 MySQL 에러(ER_NO_REFERENCED_ROW)가 그대로 500 으로 나가므로
// 미리 확인해서 어떤 필드가 잘못됐는지 400 으로 알려 준다.

async function regionExists(regionId) {
  const [rows] = await pool.query(`SELECT id FROM regions WHERE id = ?`, [regionId]);
  return rows.length > 0;
}

async function userExists(userId) {
  const [rows] = await pool.query(`SELECT id FROM users WHERE id = ?`, [userId]);
  return rows.length > 0;
}

// ---------- 설문v2 저장 ----------

/**
 * 설문v2 응답 1건을 저장한다.
 *
 * 설문 본문(preference_surveys)과 키워드 선택(survey_keywords)은 한 트랜잭션이다.
 * 본문만 저장되고 키워드가 빠지면 CP-SAT 이 "선호 없음" 설문으로 오해한다.
 *
 * @returns {Promise<number>} 생성된 survey id
 */
async function createSurveyV2(input) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [inserted] = await conn.query(
      `INSERT INTO preference_surveys
        (user_id, region_id, budget, start_min, end_min, min_points, max_points,
        travel_date, include_festival)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.regionId,
        input.budget,
        input.startMin,
        input.endMin,
        input.minPoints,
        input.maxPoints,
        input.travelDate ?? null,
        input.includeFestival ? 1 : 0,
      ]
    );
    const surveyId = inserted.insertId;

    const keywordRows = [
      ...input.selectedKeywordIds.map((id) => [surveyId, id, "selected"]),
      ...input.excludedKeywordIds.map((id) => [surveyId, id, "excluded"]),
    ];

    if (keywordRows.length > 0) {
      await conn.query(
        `INSERT INTO survey_keywords (survey_id, keyword_id, usage_type) VALUES ?`,
        [keywordRows]
      );
    }

    await conn.commit();
    return surveyId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- 설문v2 조회 ----------

/** 설문 1건 + 선택/제외 키워드. 없으면 null. */
async function getSurveyV2(surveyId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.user_id, s.region_id, r.name AS region_name,
            s.budget, s.start_min, s.end_min, s.min_points, s.max_points, s.travel_date, s.include_festival, s.created_at
       FROM preference_surveys s
       LEFT JOIN regions r ON r.id = s.region_id
      WHERE s.id = ?`,
    [surveyId]
  );
  if (rows.length === 0) return null;

  const [keywords] = await pool.query(
    `SELECT sk.keyword_id, sk.usage_type, k.name, k.type
       FROM survey_keywords sk
       JOIN keywords k ON k.id = sk.keyword_id
      WHERE sk.survey_id = ?
      ORDER BY k.type, k.id`,
    [surveyId]
  );

  return {
    ...rows[0],
    selected: keywords.filter((k) => k.usage_type === "selected"),
    excluded: keywords.filter((k) => k.usage_type === "excluded"),
  };
}

/** 최근 설문 목록. 관리자 화면에서 지난 설문을 다시 돌려 볼 때 쓴다. */
async function listSurveysV2({ regionId = null, limit = 20 } = {}) {
  const params = [];
  let where = "";
  if (regionId) {
    where = "WHERE s.region_id = ?";
    params.push(regionId);
  }
  params.push(Number(limit));

  const [rows] = await pool.query(
    `SELECT s.id, s.region_id, r.name AS region_name,
            s.budget, s.start_min, s.end_min, s.min_points, s.max_points, s.created_at,
            (SELECT COUNT(*) FROM survey_keywords sk
              WHERE sk.survey_id = s.id AND sk.usage_type = 'selected') AS selected_count
       FROM preference_surveys s
       LEFT JOIN regions r ON r.id = s.region_id
       ${where}
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ?`,
    params
  );
  return rows;
}

module.exports = {
  listKeywords,
  findExistingKeywordIds,
  regionExists,
  userExists,
  createSurveyV2,
  getSurveyV2,
  listSurveysV2,
};
