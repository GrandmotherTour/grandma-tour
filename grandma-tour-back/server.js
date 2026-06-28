require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버가 켜졌습니다! 포트 번호: ${PORT}`);
});
