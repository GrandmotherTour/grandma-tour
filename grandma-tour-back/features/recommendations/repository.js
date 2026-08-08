// DB에서 설문/포인트/키워드/이동시간 조회

const pool = require("../../config/db");

async function getSurvey(surveyId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, region_id, budget, start_min, end_min, min_points, max_points
     FROM preference_surveys
     WHERE id = ?`,
    [surveyId]
  );
  return rows[0];
}

async function getSurveyKeywordIds(surveyId, usageType) {
  const [rows] = await pool.query(
    `SELECT keyword_id
     FROM survey_keywords
     WHERE survey_id = ?
       AND usage_type = ?`,
    [surveyId, usageType]
  );
  return rows.map((row) => row.keyword_id);
}

async function getCandidatePoints(regionId) {
  const [rows] = await pool.query(
    `SELECT id, region_id, guide_id, name, duration_min, open_min, close_min, reservation_required
     FROM points
     WHERE region_id = ?
       AND is_active = TRUE
     ORDER BY id`,
    [regionId]
  );
  return rows;
}

async function getPointKeywords(pointIds) {
  if (pointIds.length === 0) return {};

  const placeholders = pointIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT point_id, keyword_id
     FROM point_keywords
     WHERE point_id IN (${placeholders})`,
    pointIds
  );

  const result = {};
  for (const row of rows) {
    if (!result[row.point_id]) result[row.point_id] = [];
    result[row.point_id].push(row.keyword_id);
  }
  return result;
}

async function getTravelTimes(regionId, transportMode = "taxi") {
  const [rows] = await pool.query(
    `SELECT
       t.from_point_id AS fromPointId,
       t.to_point_id AS toPointId,
       t.travel_min AS travelMin
     FROM travel_time_cache t
     JOIN points p1 ON p1.id = t.from_point_id
     JOIN points p2 ON p2.id = t.to_point_id
     WHERE p1.region_id = ?
       AND p2.region_id = ?
       AND t.transport_mode = ?`,
    [regionId, regionId, transportMode]
  );
  return rows;
}

async function loadRecommendationInput(surveyId, transportMode = "taxi") {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error(`Survey not found: ${surveyId}`);
  }

  const selectedKeywordIds = await getSurveyKeywordIds(surveyId, "selected");
  const excludedKeywordIds = await getSurveyKeywordIds(surveyId, "excluded");
  const points = await getCandidatePoints(survey.region_id);
  const pointKeywords = await getPointKeywords(points.map((point) => point.id));
  const travelTimes = await getTravelTimes(survey.region_id, transportMode);

  return {
    survey,
    selectedKeywordIds,
    excludedKeywordIds,
    points,
    pointKeywords,
    travelTimes,
  };
}

module.exports = {
  loadRecommendationInput,
};