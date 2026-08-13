// .env 는 저장소 루트에 있다. 인자 없이 config() 를 부르면 CWD 기준이라
// grandma-tour-back 에서 npm start 할 때 읽히지 않는다.
// (그러면 TOUR_API_KEY 가 없어 파이프라인이 mock 으로 떨어진다)
// config/db.js 도 같은 방식으로 루트를 가리킨다.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버가 켜졌습니다! 포트 번호: ${PORT}`);
  console.log(`   관광 데이터 소스: ${require('./features/poi/tourApiClient').getSourceMode().reason}`);
});
