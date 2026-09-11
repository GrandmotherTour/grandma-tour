// 설문 라우트 — v1(집단 사전 설문) / v2(개인 설문)를 경로에서부터 나눈다.
//
// v1 은 읽기 전용이다. 수요값 입력은 아직 저장 대상이 아니라
// 파이프라인 호출 body 의 surveyDemand 로 실려 간다
// (POST /api/admin/regions/preview — features/poi/routes.js).

const express = require("express");
const controller = require("./controller");

const router = express.Router();

// ── 설문v1: 집단 사전 설문 (거점 선정용) ────────────────────────
router.get("/v1/categories", controller.getV1Categories);

// ── 설문v2: 개인 설문 (루트 생성용) ─────────────────────────────
router.get("/v2/keywords", controller.getV2Keywords);
router.post("/v2/responses", controller.createV2Response);
router.get("/v2/responses", controller.listV2Responses);
router.get("/v2/responses/:id", controller.getV2Response);

module.exports = router;
