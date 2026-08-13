// 사전 사용자 설문 — 카테고리별 집단 선호
//
// ── 무엇을 대체하는가 ────────────────────────────────────────────
// 옛 파이프라인의 40/36/20/6 배점(인기도·키워드적합·근접도·이미지)을 대체한다.
// 그 배점은 근거가 없어 삭제했고, 대체할 공개 데이터도 없었다
// (POI 단위 인기도를 주는 API 가 존재하지 않는다 — docs/poi-selection-research.md).
//
// 대신 **전체 이용 예정자의 집단 선호**를 쓴다. 개별 사용자 설문(CP-SAT 입력)과
// 다르다 — 거점을 어디에 둘지는 특정 사용자가 아니라 수요 전체를 봐야 한다.
//
// ── 중요: 이것은 카테고리 단위 신호다 ────────────────────────────
// "자연이 역사·문화보다 수요가 높다"는 말해 주지만
// "이 POI 가 좋은 명소인가"는 말해 주지 않는다.
// 개별 장소의 거점 적격성(예: 실탄사격장을 거점으로 둘 것인가)은
// 이 데이터로 판단할 수 없고 현장 검수의 몫이다.
//
// ── 현재 상태: MOCK ─────────────────────────────────────────────
// 실제 설문을 아직 돌리지 않았다. 아래 값은 **가짜다.**
// 결과에 항상 source 를 실어 보내 실측으로 오인되지 않게 한다.
// 실제 설문이 들어오면 loadSurvey() 만 교체하면 된다.

const { PREFERENCE_CATEGORIES } = require("./keywordMapper");

// 응답자 중 해당 카테고리를 선호한다고 답한 비율(0~1).
// 합이 1 이 아니다 — 복수 응답이므로 각각 독립적인 비율이다.
//
// ⚠ 전부 가짜 값이다. 실제 설문 결과로 교체해야 한다.
const MOCK_CATEGORY_DEMAND = Object.freeze({
  자연: 0.7,
  "역사·문화": 0.55,
  체험: 0.48,
  음식: 0.45,
  "시장·지역생활": 0.3,
});

const SURVEY_SOURCE_MOCK = "mock";
const SURVEY_SOURCE_LIVE = "survey";

/**
 * 집단 선호를 읽어온다.
 *
 * @returns {{demand: Object<string, number>, source: string, respondents: number|null, note: string}}
 *   source 가 "mock" 이면 이 실행의 선정 결과는 실제 수요를 반영한 것이 아니다.
 */
function loadSurvey({ demand = null, respondents = null } = {}) {
  if (demand && Object.keys(demand).length > 0) {
    return {
      demand: { ...demand },
      source: SURVEY_SOURCE_LIVE,
      respondents,
      note: "실제 설문 응답",
    };
  }

  return {
    demand: { ...MOCK_CATEGORY_DEMAND },
    source: SURVEY_SOURCE_MOCK,
    respondents: null,
    note: "⚠ 설문 미실시 — 가짜 수요값. 이 실행의 카테고리 가중은 근거가 없다.",
  };
}

/**
 * 카테고리 집합이 흡수하는 수요.
 *
 * 단순 개수(category_coverage)와 다른 점:
 *   {자연, 역사·문화}  → 1.25   (개수 2)
 *   {음식, 시장·지역생활} → 0.75   (개수 2)
 * 개수는 같지만 수요는 다르다.
 *
 * @param {Iterable<string>} categories
 * @param {Object<string, number>} demand
 */
function demandOf(categories, demand) {
  let total = 0;
  for (const category of new Set(categories)) {
    total += demand[category] || 0;
  }
  return Number(total.toFixed(4));
}

/**
 * 지역에서 실제로 얻을 수 있는 카테고리들의 수요 총합.
 * 조합의 흡수 수요를 이 값으로 나누면 "가능한 수요 중 몇 %를 덮는가"가 된다.
 */
function attainableDemand(availableCategories, demand) {
  return demandOf(availableCategories, demand);
}

/** 설문에 없는 카테고리가 있는지 — 어휘가 바뀌면 알아채야 한다. */
function findUncoveredCategories(demand) {
  return PREFERENCE_CATEGORIES.filter((c) => !(c in demand));
}

module.exports = {
  loadSurvey,
  demandOf,
  attainableDemand,
  findUncoveredCategories,
  MOCK_CATEGORY_DEMAND,
  SURVEY_SOURCE_MOCK,
  SURVEY_SOURCE_LIVE,
};
