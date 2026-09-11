// 관리자 - 지역/가이드 포인트 선정 라우트
const express = require("express");
const controller = require("./controller");

const router = express.Router();

// 시도/시군구 코드 조회
router.get("/area-codes", controller.getAreaCodes);

// 선정 파이프라인 미리보기 (DB 저장 없음, trace 반환)
router.post("/regions/preview", controller.previewSelection);

// 파이프라인 실행 + 결과 저장. 확정이 아니라 후보 기록이다.
router.post("/regions/runs", controller.saveSelectionRun);
router.get("/regions/runs", controller.listSelectionRuns);
router.get("/regions/runs/:runId/combinations", controller.getRunCombinations);

// 조합 확정 — poi_candidates → points 승격.
// 여기서부터 설문v2(CP-SAT) 루트 생성의 대상이 된다.
router.post(
  "/regions/runs/:runId/combinations/:combinationId/promote",
  controller.promoteCombination
);

module.exports = router;
