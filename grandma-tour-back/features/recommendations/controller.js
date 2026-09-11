//  API 요청/응답 처리

const recommendationService = require("./service");

async function getRecommendations(req, res, next) {
  try {
    const surveyId = Number(req.query.surveyId); // Url의 쿼리 파라미터 : surveyId -> 필수, topN -> 선택, default 3
    const topN = Number(req.query.topN || 3);

    if (!surveyId) {
      return res.status(400).json({
        message: "surveyId is required",
      });
    }

    const result = await recommendationService.getRecommendations(
      surveyId,
      topN
    );

    return res.json({
      surveyId,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRecommendations,
};
