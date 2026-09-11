// 관리자 - 지역/가이드 포인트 선정 API 컨트롤러

const { runSelectionPipeline, toLegacyShape } = require("./selectionPipeline");
const tourApi = require("./tourApiClient");
const candidateRepository = require("./candidateRepository");
const promotionRepository = require("./promotionRepository");

// GET /api/admin/area-codes?areaCode=35
// 시도 목록(areaCode 미지정) 또는 시군구 목록(areaCode 지정)
//
// mock 데이터를 여기서 직접 꺼내지 않는다. 예전에는 시도 목록을 mockData.AREA_LIST
// 에서 바로 읽어 live 모드에서도 mock 4건이 나가면서 mode:"live" 라벨이 붙었다.
// mock/live 분기는 tourApiClient 한 곳에서만 일어나야 한다.
async function getAreaCodes(req, res, next) {
  try {
    const { areaCode } = req.query;
    const items = await tourApi.getAreaCodes({ areaCode });
    return res.json({
      mode: tourApi.isMockMode() ? "mock" : "live",
      areaCode: areaCode || null,
      items,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/regions/preview
// body: { areaCode, sigunguCode, sigunguName, contentTypeIds,
//         detailLimit, fetchImages, maxMatrixPoints, kakaoSampleSize }
//
// 파이프라인 내부는 snake_case 이므로 응답 경계에서 camelCase 로 변환한다.
// (docs/poi-selection-refactor-inventory.md §3, 결정 A)
async function previewSelection(req, res, next) {
  try {
    const result = await runSelectionPipeline(req.body || {});
    return res.json({
      ...result,
      candidates: result.candidates.map(toLegacyShape),
      selected: result.selected.map(toLegacyShape),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/regions/runs
// 파이프라인을 돌리고 결과를 DB 에 저장한다. preview 와 달리 흔적이 남는다.
//
// 확정이 아니라 **후보 기록**이다. 최종 거점 확정(points 반영)은 별도 단계다.
async function saveSelectionRun(req, res, next) {
  try {
    const result = await runSelectionPipeline(req.body || {});
    const saved = await candidateRepository.saveSelectionRun(result);

    return res.status(201).json({
      ...saved,
      // 이 실행이 실측인지 mock 인지를 응답에서도 분명히 한다.
      warning:
        saved.sourceMode === "mock" || saved.surveySource === "mock"
          ? `⚠ mock 포함 (데이터=${saved.sourceMode}, 설문=${saved.surveySource}) — 실측 결과가 아닙니다`
          : null,
      steps: result.steps.map((s) => ({ id: s.id, summary: s.summary })),
    });
  } catch (err) {
    if (err.code === "SCHEMA_NOT_READY") {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
}

// GET /api/admin/regions/runs?areaCode=35&sigunguCode=21
async function listSelectionRuns(req, res, next) {
  try {
    const { areaCode, sigunguCode, limit } = req.query;
    const items = await candidateRepository.listRuns({ areaCode, sigunguCode, limit });
    return res.json({ items });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/regions/runs/:runId/combinations
async function getRunCombinations(req, res, next) {
  try {
    const items = await candidateRepository.getRunCombinations(req.params.runId);
    return res.json({ runId: Number(req.params.runId), items });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/regions/runs/:runId/combinations/:combinationId/promote
// 후보 조합 하나를 운영 거점으로 확정한다.
//
// saveSelectionRun 이 "후보 기록" 이라면 이쪽은 **확정**이다.
// 여기서부터 그 거점들이 설문v2(CP-SAT) 루트 생성의 대상이 된다.
async function promoteCombination(req, res, next) {
  try {
    const result = await promotionRepository.promoteCombination({
      runId: Number(req.params.runId),
      combinationId: Number(req.params.combinationId),
    });

    // 무엇이 비어 있는 채로 올라갔는지 반드시 알린다.
    // 승격은 되돌리기 번거로운 조작이라 조용히 성공하면 안 된다.
    const warnings = [];
    if (result.sourceMode === "mock" || result.surveySource === "mock") {
      warnings.push(
        `⚠ mock 포함 승격 (데이터=${result.sourceMode}, 설문=${result.surveySource}) — 실측 결과가 아닙니다`
      );
    }
    if (result.hoursUnknownCount > 0) {
      warnings.push(
        `운영시간 미확인 ${result.hoursUnknownCount}건 — open_min/close_min 이 NULL 입니다 (폴백을 넣지 않았습니다)`
      );
    }
    if (result.unmappedCount > 0) {
      warnings.push(`선호 카테고리 미매핑 ${result.unmappedCount}건 — 루트 선호 매칭에서 제외됩니다`);
    }
    const fallbackPairs = Object.entries(result.travel.bySource || {})
      .filter(([source]) => source !== "kakao")
      .reduce((sum, [, n]) => sum + n, 0);
    if (fallbackPairs > 0) {
      warnings.push(`이동시간 근사·실패 ${fallbackPairs}쌍 — 카카오 실측이 아닙니다`);
    }
    if (result.needsReview) {
      warnings.push("이 조합은 needs_review 상태였습니다 — 현장 검수가 끝났는지 확인하세요");
    }

    return res.status(201).json({ ...result, warnings });
  } catch (err) {
    if (err.code === "SCHEMA_NOT_READY") return res.status(503).json({ error: err.message });
    if (err.code === "COMBINATION_NOT_FOUND") return res.status(404).json({ error: err.message });
    if (err.code === "COMBINATION_EMPTY") return res.status(422).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  getAreaCodes,
  previewSelection,
  saveSelectionRun,
  listSelectionRuns,
  getRunCombinations,
  promoteCombination,
};
