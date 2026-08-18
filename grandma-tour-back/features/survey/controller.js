// 설문 API 컨트롤러
//
// ── 설문 두 종류를 이름으로 구분한다 ─────────────────────────────
//   설문v1  집단 사전 설문. 카테고리별 전체 수요(자연 0.70 …).
//           → 거점(GUIDE_HUB) 선정에 쓰인다. 값 한 벌뿐이라 행 저장이 아니다.
//           소유: features/poi/surveyPreference.js
//   설문v2  개인 설문. 한 사용자의 예산·시간·선호/제외 키워드.
//           → CP-SAT 루트 생성에 쓰인다. 응답마다 1행.
//           소유: 이 파일 + repository.js
//
// 둘은 입력도 산출물도 다르다. 화면에서 섞이지 않도록 경로도 v1/v2 로 나눈다.

const repository = require("./repository");
const surveyPreference = require("../poi/surveyPreference");
const { PREFERENCE_CATEGORIES } = require("../poi/keywordMapper");

// 관리자 페이지에서 만드는 설문의 소유자.
// preference_surveys.user_id 가 NOT NULL + FK 라 값이 반드시 있어야 한다.
// 인증이 붙기 전까지는 시드 사용자로 둔다 — 로그인 붙으면 req.user.id 로 교체한다.
// (middlewares/auth.middleware.js 는 현재 비어 있다)
const ADMIN_DEMO_USER_ID = 1;

const MINUTES_IN_DAY = 24 * 60;

// ---------- 설문v1 ----------

// GET /api/survey/v1/categories
// 설문v1 의 어휘와 현재 수요값. 화면이 5종 카테고리를 하드코딩하지 않게 한다.
//
// source 를 반드시 함께 내보낸다. "mock" 이면 이 수요값에는 근거가 없고,
// 이 값으로 돌린 거점 선정 결과도 실측이 아니다.
function getV1Categories(req, res, next) {
  try {
    const survey = surveyPreference.loadSurvey();
    return res.json({
      categories: PREFERENCE_CATEGORIES,
      demand: survey.demand,
      source: survey.source,
      respondents: survey.respondents,
      note: survey.note,
      // 설문v2 문항(keywords.preference)과 같은 어휘여야 한다.
      // 어긋나면 v1 결과를 v2 입력으로 변환할 때 근거 없는 대응표가 생긴다.
      sharedWith: "설문v2 preference 키워드",
    });
  } catch (err) {
    next(err);
  }
}

// ---------- 설문v2 ----------

// GET /api/survey/v2/keywords
async function getV2Keywords(req, res, next) {
  try {
    const rows = await repository.listKeywords();
    return res.json({
      // 관광 선호. 설문v1 카테고리와 같은 어휘다.
      preference: rows.filter((k) => k.type === "preference"),
      // 운영 조건. 선호가 아니므로 v1 수요값과 무관하다.
      environment: rows.filter((k) => k.type === "environment"),
      constraint: rows.filter((k) => k.type === "constraint"),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 설문v2 입력 검증.
 * 값을 고쳐 주지 않는다 — 잘못된 입력은 어느 필드가 왜 틀렸는지 돌려준다.
 * @returns {{errors: Array<{field: string, message: string}>, value: object|null}}
 */
function parseSurveyV2Body(body) {
  const errors = [];
  const b = body || {};

  const int = (raw) => {
    if (raw === undefined || raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : NaN;
  };

  const regionId = int(b.regionId);
  const budget = int(b.budget);
  const startMin = int(b.startMin);
  const endMin = int(b.endMin);
  const minPoints = b.minPoints === undefined ? 2 : int(b.minPoints);
  const maxPoints = b.maxPoints === undefined ? 3 : int(b.maxPoints);
  const userId = b.userId === undefined ? ADMIN_DEMO_USER_ID : int(b.userId);
  const travelDate = b.travelDate || null;
  const includeFestival = b.includeFestival === true;

  if (!Number.isInteger(regionId) || regionId <= 0)
    errors.push({ field: "regionId", message: "지역을 선택하세요." });
  if (!Number.isInteger(budget) || budget < 0)
    errors.push({ field: "budget", message: "예산은 0 이상의 정수여야 합니다." });

  if (!Number.isInteger(startMin) || startMin < 0 || startMin > MINUTES_IN_DAY)
    errors.push({ field: "startMin", message: "시작 시각은 0~1440 분입니다." });
  if (!Number.isInteger(endMin) || endMin < 0 || endMin > MINUTES_IN_DAY)
    errors.push({ field: "endMin", message: "종료 시각은 0~1440 분입니다." });
  if (Number.isInteger(startMin) && Number.isInteger(endMin) && startMin >= endMin)
    errors.push({ field: "endMin", message: "종료 시각이 시작 시각보다 늦어야 합니다." });

  if (!Number.isInteger(minPoints) || minPoints < 1)
    errors.push({ field: "minPoints", message: "최소 방문지는 1 이상입니다." });
  if (!Number.isInteger(maxPoints) || maxPoints < 1)
    errors.push({ field: "maxPoints", message: "최대 방문지는 1 이상입니다." });
  if (Number.isInteger(minPoints) && Number.isInteger(maxPoints) && minPoints > maxPoints)
    errors.push({ field: "maxPoints", message: "최대 방문지가 최소보다 크거나 같아야 합니다." });

  if (!Number.isInteger(userId) || userId <= 0)
    errors.push({ field: "userId", message: "사용자 id 가 올바르지 않습니다." });

  if (travelDate && !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) 
    errors.push({ field: "travelDate", message: "여행 날짜는 YYYY-MM-DD 형식이어야 합니다."});
  if (b.includeFestival !== undefined && typeof b.includeFestival !== "boolean") 
    errors.push({ field: "includeFestival", message: "축제 포함 여부는 true 또는 false여야 합니다."});
  

  const idList = (raw, field) => {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
      errors.push({ field, message: "키워드 id 배열이어야 합니다." });
      return [];
    }
    const ids = raw.map(Number);
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      errors.push({ field, message: "키워드 id 는 양의 정수여야 합니다." });
      return [];
    }
    return [...new Set(ids)];
  };

  const selectedKeywordIds = idList(b.selectedKeywordIds, "selectedKeywordIds");
  const excludedKeywordIds = idList(b.excludedKeywordIds, "excludedKeywordIds");

  // 같은 키워드를 선호이자 제외로 낼 수 없다.
  // survey_keywords 는 (survey_id, keyword_id, usage_type) 이 PK 라 DB 는 막지 못한다.
  const overlap = selectedKeywordIds.filter((id) => excludedKeywordIds.includes(id));
  if (overlap.length > 0) {
    errors.push({
      field: "excludedKeywordIds",
      message: `선호와 제외에 같은 키워드가 있습니다: ${overlap.join(", ")}`,
    });
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: {
      userId,
      regionId,
      budget,
      startMin,
      endMin,
      minPoints,
      maxPoints,
      travelDate,
      includeFestival,
      selectedKeywordIds,
      excludedKeywordIds,
    },
  };
}

// POST /api/survey/v2/responses
async function createV2Response(req, res, next) {
  try {
    const { errors, value } = parseSurveyV2Body(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "설문 입력이 올바르지 않습니다.", errors });
    }

    // FK 위반을 500 으로 흘리지 않고 어느 필드가 문제인지 알려 준다.
    const refErrors = [];
    if (!(await repository.regionExists(value.regionId)))
      refErrors.push({ field: "regionId", message: `존재하지 않는 지역입니다: ${value.regionId}` });
    if (!(await repository.userExists(value.userId)))
      refErrors.push({ field: "userId", message: `존재하지 않는 사용자입니다: ${value.userId}` });

    const requestedKeywordIds = [...value.selectedKeywordIds, ...value.excludedKeywordIds];
    const existingKeywordIds = await repository.findExistingKeywordIds(requestedKeywordIds);
    const missingKeywordIds = requestedKeywordIds.filter((id) => !existingKeywordIds.includes(id));
    if (missingKeywordIds.length > 0) {
      refErrors.push({
        field: "selectedKeywordIds",
        message: `존재하지 않는 키워드입니다: ${missingKeywordIds.join(", ")}`,
      });
    }

    if (refErrors.length > 0) {
      return res.status(400).json({ message: "참조가 올바르지 않습니다.", errors: refErrors });
    }

    const surveyId = await repository.createSurveyV2(value);
    const survey = await repository.getSurveyV2(surveyId);

    return res.status(201).json({
      surveyId,
      survey,
      // 다음에 무엇을 호출하면 루트가 나오는지. 화면이 경로를 하드코딩하지 않게 한다.
      next: `/api/recommendations?surveyId=${surveyId}&topN=3`,
      // 선호 키워드가 없으면 CP-SAT 이 선호 항을 0 으로 풀어 이동시간만 최소화한다.
      warning:
        value.selectedKeywordIds.length === 0
          ? "선호 키워드가 없습니다 — 루트가 선호와 무관하게 이동시간만으로 결정됩니다."
          : null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/survey/v2/responses/:id
async function getV2Response(req, res, next) {
  try {
    const survey = await repository.getSurveyV2(Number(req.params.id));
    if (!survey) {
      return res.status(404).json({ message: `설문을 찾을 수 없습니다: ${req.params.id}` });
    }
    return res.json(survey);
  } catch (err) {
    next(err);
  }
}

// GET /api/survey/v2/responses?regionId=1&limit=20
async function listV2Responses(req, res, next) {
  try {
    const items = await repository.listSurveysV2({
      regionId: req.query.regionId ? Number(req.query.regionId) : null,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    return res.json({ items });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getV1Categories,
  getV2Keywords,
  createV2Response,
  getV2Response,
  listV2Responses,
  parseSurveyV2Body,
  ADMIN_DEMO_USER_ID,
};
