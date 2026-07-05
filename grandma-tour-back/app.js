const express = require("express");
const cors = require("cors");
const recommendationRoutes = require("./features/recommendations/routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/recommendations", recommendationRoutes);

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