const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// 기본 라우트
app.get('/', (req, res) => {
  res.send('👵 할매투어 백엔드 서버가 정상적으로 작동 중입니다! 👵');
});

// 기능별 라우터 연동 예시
// const authRoutes = require('./features/auth/auth.routes');
// app.use('/api/auth', authRoutes);

module.exports = app;
