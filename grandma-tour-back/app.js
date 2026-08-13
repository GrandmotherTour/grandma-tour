const express = require("express");
const cors = require("cors");
const recommendationRoutes = require("./features/recommendations/routes");
const regionRouter = require('./features/region/region.route');

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.',
    });
  }

  return res.json({
    user: { name: email.split('@')[0] || 'Traveler', email },
    token: 'local-development-token',
  });
});
app.use('/api/regions', regionRouter);

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
