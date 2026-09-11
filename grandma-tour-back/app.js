const express = require("express");
const cors = require("cors");
const recommendationRoutes = require("./features/recommendations/recommendations.route");
const regionRouter = require('./features/region/region.route');
const adminPoiRoutes = require("./features/poi/routes");
const surveyRoutes = require("./features/survey/routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/regions', regionRouter);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/admin", adminPoiRoutes);
// 설문v1(집단 사전 설문) / 설문v2(개인 설문)
app.use("/api/survey", surveyRoutes);


app.get("/", (req, res) => {
  res.send("할매투어 백엔드 서버가 정상적으로 작동 중입니다!");
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal server error",
    error: err.message,
  });
});

module.exports = app;