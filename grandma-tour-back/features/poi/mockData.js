// mock 데이터: 인증키 발급 전에도 파이프라인/관리자 화면이 실제로 돌아가도록
// TourAPI areaBasedList2 응답 아이템과 동일한 형태로 청송군 POI 를 정의한다.
// 일부러 "좌표 없음", "중복" 같은 지저분한 데이터를 섞어 정제 단계를 시연한다.
//
// mapx = 경도(lon), mapy = 위도(lat) — TourAPI 규격과 동일.

// contentTypeId: 12 관광지, 14 문화시설, 15 축제/행사, 25 여행코스,
//                28 레포츠, 38 쇼핑, 39 음식점
const CHEONGSONG_POIS = [
  { contentid: "1001", contenttypeid: "12", title: "주왕산국립공원", addr1: "경북 청송군 주왕산면 공원길 226", mapx: "129.1476", mapy: "36.3936", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/juwang.jpg" },
  { contentid: "1002", contenttypeid: "12", title: "대전사", addr1: "경북 청송군 주왕산면 공원길 226", mapx: "129.1470", mapy: "36.3940", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/daejeonsa.jpg" },
  { contentid: "1003", contenttypeid: "12", title: "주산지", addr1: "경북 청송군 주왕산면 주산지길 163", mapx: "129.1030", mapy: "36.3567", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/jusanji.jpg" },
  { contentid: "1004", contenttypeid: "12", title: "청송 얼음골", addr1: "경북 청송군 주왕산면 팔각산로 228", mapx: "129.1810", mapy: "36.3490", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/icevalley.jpg" },
  { contentid: "1005", contenttypeid: "12", title: "달기약수탕", addr1: "경북 청송군 청송읍 약수길", mapx: "129.0430", mapy: "36.4470", tel: "", firstimage: "" },
  { contentid: "1006", contenttypeid: "12", title: "신촌약수탕", addr1: "경북 청송군 진보면 신촌약수길", mapx: "129.0720", mapy: "36.5230", tel: "", firstimage: "" },
  { contentid: "1007", contenttypeid: "14", title: "송소고택", addr1: "경북 청송군 파천면 송소고택길 15-2", mapx: "129.0000", mapy: "36.4520", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/songso.jpg" },
  { contentid: "1008", contenttypeid: "14", title: "청송백자전수관", addr1: "경북 청송군 청송읍 백자로", mapx: "129.0570", mapy: "36.4290", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/baekja.jpg" },
  { contentid: "1009", contenttypeid: "14", title: "객주문학관", addr1: "경북 청송군 진보면 청송로 6359-7", mapx: "129.1010", mapy: "36.5340", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/gaekju.jpg" },
  { contentid: "1010", contenttypeid: "14", title: "청송야송미술관", addr1: "경북 청송군 부남면 청송로", mapx: "129.0640", mapy: "36.2790", tel: "", firstimage: "" },
  { contentid: "1011", contenttypeid: "28", title: "청송사과테마파크", addr1: "경북 청송군 청송읍 부곡리", mapx: "129.0330", mapy: "36.4180", tel: "", firstimage: "https://tong.visitkorea.or.kr/mock/applepark.jpg" },
  { contentid: "1012", contenttypeid: "28", title: "주왕산자연휴양림", addr1: "경북 청송군 주왕산면", mapx: "129.1200", mapy: "36.4050", tel: "", firstimage: "" },
  { contentid: "1013", contenttypeid: "39", title: "청송사과먹거리타운", addr1: "경북 청송군 청송읍 중앙로", mapx: "129.0560", mapy: "36.4330", tel: "", firstimage: "" },
  // --- 일부러 넣은 지저분한 데이터 (정제 단계 시연용) ---
  { contentid: "1014", contenttypeid: "12", title: "좌표없는관광지(테스트)", addr1: "경북 청송군", mapx: "", mapy: "", tel: "", firstimage: "" },
  { contentid: "1015", contenttypeid: "12", title: "주왕산국립공원", addr1: "경북 청송군 주왕산면 공원길 226", mapx: "129.1476", mapy: "36.3936", tel: "", firstimage: "" },
];

// POI_KEYWORDS(손으로 지어낸 POI별 키워드 맵)와 REGION_CENTERS(중심좌표 폴백)는
// 제거했다. 전자는 keywordMapper 를 만들 때 추정값을 코드에 다시 심을 위험이 있었고
// (키워드는 cat1/2/3 에서 유도한다), 후자는 중심 반경 방식을 폐기하면서 쓸 곳이 없어졌다.

// 경북(35) 시군구 목록 — 2026-08-13 areaCode2 실호출 응답 그대로.
// 이전 버전은 상주시부터 코드가 한 칸씩 밀려 있어 청송군을 19(=의성군)로 가리켰다.
// 코드 5(구 군위군, 대구 편입)는 응답에 없다.
const GYEONGBUK_SIGUNGU = [
  { code: "1", name: "경산시" },
  { code: "2", name: "경주시" },
  { code: "3", name: "고령군" },
  { code: "4", name: "구미시" },
  { code: "6", name: "김천시" },
  { code: "7", name: "문경시" },
  { code: "8", name: "봉화군" },
  { code: "9", name: "상주시" },
  { code: "10", name: "성주군" },
  { code: "11", name: "안동시" },
  { code: "12", name: "영덕군" },
  { code: "13", name: "영양군" },
  { code: "14", name: "영주시" },
  { code: "15", name: "영천시" },
  { code: "16", name: "예천군" },
  { code: "17", name: "울릉군" },
  { code: "18", name: "울진군" },
  { code: "19", name: "의성군" },
  { code: "20", name: "청도군" },
  { code: "21", name: "청송군" },
  { code: "22", name: "칠곡군" },
  { code: "23", name: "포항시" },
];

// 시도 목록 mock — 전체가 아니라 개발용 일부다.
// **직접 import 하지 말 것.** tourApiClient.getAreaCodes() 를 거쳐야
// mock/live 가 모드에 따라 갈린다.
const AREA_LIST = [
  { code: "1", name: "서울" },
  { code: "2", name: "인천" },
  { code: "35", name: "경상북도" },
  { code: "36", name: "경상남도" },
];

function getMockAreaBasedList({ contentTypeIds = [] } = {}) {
  if (!contentTypeIds || contentTypeIds.length === 0) return CHEONGSONG_POIS;
  const wanted = new Set(contentTypeIds.map(String));
  return CHEONGSONG_POIS.filter((p) => wanted.has(String(p.contenttypeid)));
}

function getMockSigunguList(areaCode) {
  if (String(areaCode) === "35") return GYEONGBUK_SIGUNGU;
  return [];
}

function getMockAreaList() {
  return AREA_LIST;
}

module.exports = {
  // 상수는 테스트·검증용으로만 노출한다.
  // 실행 경로에서는 tourApiClient 를 거쳐야 mock/live 가 모드에 따라 갈린다.
  CHEONGSONG_POIS,
  GYEONGBUK_SIGUNGU,
  AREA_LIST,
  getMockAreaBasedList,
  getMockSigunguList,
  getMockAreaList,
};
