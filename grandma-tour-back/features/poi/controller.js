// 관리자 - 지역/가이드 포인트 선정 API 컨트롤러

const { runSelectionPipeline, toLegacyShape } = require("./selectionPipeline");
const tourApi = require("./tourApiClient");

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

module.exports = {
  getAreaCodes,
  previewSelection,
};
