// 한국관광 데이터랩 (관광 빅데이터) - 지역 방문자 통계 클라이언트
//
// 용도: 기초지자체(시군구)/관광지 단위 방문자수·인기도 지표를 받아
//       가이드 포인트 랭킹 가중치로 사용.
// 데이터랩 오픈 API 는 data.go.kr 또는 datalab.visitkorea.or.kr 를 통해 제공되며,
// 데이터셋마다 엔드포인트가 다르므로 베이스/오퍼레이션을 env 로 주입받는다.
//   DATALAB_BASE_URL, DATALAB_API_KEY, DATALAB_OPERATION
//
// 키가 없으면 이름 기반의 안정적(deterministic) 인기도 점수를 돌려줘
// mock 모드에서도 랭킹이 재현 가능하게 한다.

const DEFAULT_TIMEOUT_MS = Number(process.env.DATALAB_TIMEOUT_MS || 8000);

function hasDataLabKey() {
  return Boolean(process.env.DATALAB_API_KEY) &&
    Boolean(process.env.DATALAB_BASE_URL) &&
    process.env.POI_SOURCE_MODE !== "mock";
}

// 이름을 0~100 사이 안정적 점수로 변환 (mock 폴백용)
function deterministicScore(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  // 40~95 범위로 매핑해 너무 낮은 값이 나오지 않게
  return 40 + (hash % 56);
}

// 유명 청송 관광지에 대한 mock 방문자 인기도(월 방문자 index, 임의 스케일)
const MOCK_POPULARITY = {
  주왕산국립공원: 96,
  주왕산: 96,
  대전사: 78,
  주산지: 90,
  송소고택: 72,
  청송백자전수관: 55,
  청송사과테마파크: 68,
  "청송 얼음골": 74,
  얼음골: 74,
  객주문학관: 58,
  달기약수탕: 63,
  신촌약수탕: 49,
  청송야송미술관: 52,
  주왕산자연휴양림: 66,
};

// POI 목록에 popularity(0~100) 를 부여한 맵을 반환
// { [poiName]: { popularity, source } }
async function getPopularityMap(poiNames, { regionName } = {}) {
  const result = {};

  if (hasDataLabKey()) {
    try {
      const stats = await fetchDataLabStats(regionName);
      for (const name of poiNames) {
        const hit = stats[name];
        result[name] = {
          popularity: hit != null ? hit : deterministicScore(name),
          source: hit != null ? "datalab" : "fallback",
        };
      }
      return result;
    } catch (err) {
      console.warn("[datalab] 통계 조회 실패, 폴백 사용:", err.message);
    }
  }

  for (const name of poiNames) {
    const mock = MOCK_POPULARITY[name];
    result[name] = {
      popularity: mock != null ? mock : deterministicScore(name),
      source: mock != null ? "mock" : "fallback",
    };
  }
  return result;
}

// 라이브 데이터랩 호출 (데이터셋별로 응답 파싱이 달라 최소 골격만 제공)
async function fetchDataLabStats(regionName) {
  const search = new URLSearchParams({
    serviceKey: process.env.DATALAB_API_KEY,
    _type: "json",
    numOfRows: "100",
    pageNo: "1",
    ...(regionName ? { signguNm: regionName } : {}),
  });
  const operation = process.env.DATALAB_OPERATION || "";
  const url = `${process.env.DATALAB_BASE_URL}/${operation}?${search.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const json = await res.json();
    const items = json?.response?.body?.items?.item || [];
    const rows = Array.isArray(items) ? items : [items];

    // 데이터셋에 따라 필드명이 다르므로 흔한 후보들을 방어적으로 매핑
    const stats = {};
    for (const row of rows) {
      const name = row.tAtsNm || row.touAtsNm || row.name || row.signguNm;
      const value = Number(
        row.touNum || row.visitorCnt || row.value || row.cnt || 0
      );
      if (name) stats[name] = value;
    }
    // 방문자 수 → 0~100 정규화
    const values = Object.values(stats);
    const max = Math.max(1, ...values);
    for (const key of Object.keys(stats)) {
      stats[key] = Math.round((stats[key] / max) * 100);
    }
    return stats;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  hasDataLabKey,
  getPopularityMap,
};
