const express = require("express");
const router = express.Router();

const recommendationController = require("./controller");

// 추천 코스 조회
router.get("/", recommendationController.getRecommendations);

module.exports = router;