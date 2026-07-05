const express = require("express");
const recommendationController = require("./controller");

const router = express.Router();

router.get("/", recommendationController.getRecommendations);

module.exports = router;
