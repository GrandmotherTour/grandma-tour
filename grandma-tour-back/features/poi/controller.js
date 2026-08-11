// 관리자 - 지역/가이드 포인트 선정 API 컨트롤러

const { runSelectionPipeline, GYEONGBUK_SIGUNGU } = require("./selectionPipeline");
const tourApi = require("./tourApiClient");
const { AREA_LIST } = require("./mockData");

// GET /api/admin/area-codes?areaCode=35
// 시도 목록(area 미지정) 또는 시군구 목록(areaCode 지정)
async function getAreaCodes(req, res, next) {
  try {
    const { areaCode } = req.query;
    if (!areaCode) {
      return res.json({ mode: tourApi.isMockMode() ? "mock" : "live", items: AREA_LIST });
    }
    const items = await tourApi.fetchSigunguList(areaCode);
    return res.json({ mode: tourApi.isMockMode() ? "mock" : "live", areaCode, items });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/regions/preview
// body: { areaCode, sigunguCode, sigunguName, contentTypeIds, radiusKm,
//         minPoints, maxPoints, preferredKeywords, center, tourBudgetMin }
async function previewSelection(req, res, next) {
  try {
    const result = await runSelectionPipeline(req.body || {});
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAreaCodes,
  previewSelection,
  GYEONGBUK_SIGUNGU,
};
