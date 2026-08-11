// 관리자 - 지역/가이드 포인트 선정 라우트
const express = require("express");
const controller = require("./controller");

const router = express.Router();

// 시도/시군구 코드 조회
router.get("/area-codes", controller.getAreaCodes);

// 선정 파이프라인 미리보기 (DB 저장 없음, trace 반환)
router.post("/regions/preview", controller.previewSelection);

module.exports = router;
