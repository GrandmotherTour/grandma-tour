// 한국관광공사 TourAPI (국문 관광정보 서비스, KorService2) 클라이언트
//
// data.go.kr 데이터: 한국관광공사_국문 관광정보 서비스_GW (data ID 15101578)
// 베이스 URL: http://apis.data.go.kr/B551011/KorService2/
//
// 키가 없거나 SOURCE_MODE=mock 이면 실제 호출 대신 mock 데이터를 돌려준다.
// (키 발급 후 .env 에 TOUR_API_KEY 를 넣고 POI_SOURCE_MODE=live 로 바꾸면 라이브 호출)

const { getMockAreaBasedList, getMockSigunguList } = require("./mockData");

const BASE_URL =
  process.env.TOUR_API_BASE_URL ||
  "http://apis.data.go.kr/B551011/KorService2";

const DEFAULT_TIMEOUT_MS = Number(process.env.TOUR_API_TIMEOUT_MS || 8000);

function isMockMode() {
  if (process.env.POI_SOURCE_MODE === "live") return false;
  if (process.env.POI_SOURCE_MODE === "mock") return true;
  // 모드 미지정이면 키 유무로 자동 판단
  return !process.env.TOUR_API_KEY;
}

// data.go.kr 인증키는 Encoding/Decoding 두 형태로 발급된다.
// 이미 인코딩된 키(%2B 등 포함)면 그대로, 아니면 encodeURIComponent 적용.
function normalizeServiceKey(rawKey) {
  if (!rawKey) return "";
  return /%[0-9A-Fa-f]{2}/.test(rawKey) ? rawKey : encodeURIComponent(rawKey);
}

function buildUrl(operation, params) {
  const search = new URLSearchParams({
    MobileOS: "ETC",
    MobileApp: "GrandmaTour",
    _type: "json",
    ...params,
  });
  const serviceKey = normalizeServiceKey(process.env.TOUR_API_KEY);
  return `${BASE_URL}/${operation}?serviceKey=${serviceKey}&${search.toString()}`;
}

async function requestJson(operation, params) {
  const url = buildUrl(operation, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();

    // TourAPI 는 에러 시 XML(OpenAPI_ServiceResponse)로 응답하는 경우가 있음
    if (text.trim().startsWith("<")) {
      throw new Error(`TourAPI 비정상 응답(XML): ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text);
    const header = json?.response?.header;
    if (header && header.resultCode && header.resultCode !== "0000") {
      throw new Error(
        `TourAPI 오류 [${header.resultCode}] ${header.resultMsg || ""}`
      );
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// items.item 을 항상 배열로 정규화
function extractItems(json) {
  const item = json?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// 시군구 목록 조회 (areaCode2). areaCode 를 주면 해당 시도의 시군구 목록.
async function fetchSigunguList(areaCode) {
  if (isMockMode()) {
    return getMockSigunguList(areaCode);
  }
  const json = await requestJson("areaCode2", {
    numOfRows: "50",
    pageNo: "1",
    areaCode: String(areaCode),
  });
  return extractItems(json).map((it) => ({
    code: String(it.code),
    name: it.name,
  }));
}

// 지역기반 관광정보 목록 조회 (areaBasedList2), contentTypeId 별로 페이지 순회
async function fetchAreaBasedList({
  areaCode,
  sigunguCode,
  contentTypeIds = [12, 14, 15, 25, 28, 38, 39],
  numOfRows = 100,
  maxPages = 3,
}) {
  if (isMockMode()) {
    return getMockAreaBasedList({ areaCode, sigunguCode, contentTypeIds });
  }

  const collected = [];
  for (const contentTypeId of contentTypeIds) {
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const json = await requestJson("areaBasedList2", {
        numOfRows: String(numOfRows),
        pageNo: String(pageNo),
        listYN: "Y",
        arrange: "C", // 수정일순 (대표이미지 포함 우선)
        areaCode: String(areaCode),
        sigunguCode: String(sigunguCode),
        contentTypeId: String(contentTypeId),
      });

      const items = extractItems(json);
      collected.push(...items);

      const totalCount = Number(json?.response?.body?.totalCount || 0);
      if (pageNo * numOfRows >= totalCount) break;
    }
  }
  return collected;
}

// 공통 상세정보 (detailCommon2): 개요, 좌표 등
async function fetchDetailCommon(contentId) {
  if (isMockMode()) return null;
  const json = await requestJson("detailCommon2", {
    contentId: String(contentId),
    defaultYN: "Y",
    firstImageYN: "Y",
    areacodeYN: "Y",
    addrinfoYN: "Y",
    mapinfoYN: "Y",
    overviewYN: "Y",
  });
  return extractItems(json)[0] || null;
}

// 소개정보 (detailIntro2): 운영시간(usetime), 휴무일(restdate) 등
async function fetchDetailIntro(contentId, contentTypeId) {
  if (isMockMode()) return null;
  const json = await requestJson("detailIntro2", {
    contentId: String(contentId),
    contentTypeId: String(contentTypeId),
  });
  return extractItems(json)[0] || null;
}

module.exports = {
  isMockMode,
  fetchSigunguList,
  fetchAreaBasedList,
  fetchDetailCommon,
  fetchDetailIntro,
  extractItems,
};
