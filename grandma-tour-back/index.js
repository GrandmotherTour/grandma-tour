const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000; // 백엔드는 주로 5000번 포트를 씁니다.

// 미들웨어 설정
app.use(cors()); // 프론트엔드와 백엔드가 서로 통신할 수 있게 허용
app.use(express.json()); // JSON 형식의 데이터 처리를 허용

// 기본 테스트용 주소 (브라우저에서 확인할 경로)
app.get('/', (req, res) => {
  res.send('👵 할매투어 백엔드 서버가 정상적으로 작동 중입니다! 👵');
});

// 서버 가동
app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버가 켜졌습니다! 포트 번호: ${PORT}`);
});
  