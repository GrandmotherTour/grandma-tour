// 한국관광공사 TourAPI (국문 관광정보 서비스, KorService2) — 원본 수집 전담 클라이언트
//
// data.go.kr 데이터: 한국관광공사_국문 관광정보 서비스_GW (data ID 15101578)
// 베이스 URL: http://apis.data.go.kr/B551011/KorService2/
//
// ── 이 파일의 책임 범위 ──────────────────────────────────────────────
// "호출만" 한다. 응답 아이템의 필드명을 바꾸거나, 점수를 매기거나, 걸러내지 않는다.
// 반환되는 아이템은 TourAPI 가 준 원본 그대로이며(contentid/mapx/firstimage …),
// 우리 형식으로의 변환은 poiNormalizer 의 책임이다.
// 유일한 예외는 페이지 순회로, 여러 페이지의 아이템을 한 배열로 이어붙인다.
// (아이템 자체는 손대지 않는다.)
//
// 키가 없거나 POI_SOURCE_MODE=mock 이면 실제 호출 대신 mock 데이터를 돌려준다.

const {
  getMockAreaBasedList,
  getMockSigunguList,
  getMockAreaList,
} = require("./mockData");

const BASE_URL =
  process.env.TOUR_API_BASE_URL ||
  "http://apis.data.go.kr/B551011/KorService2";

const DEFAULT_TIMEOUT_MS = Number(process.env.TOUR_API_TIMEOUT_MS || 8000);
const MAX_RETRY = Number(process.env.TOUR_API_MAX_RETRY || 1);

// ---------- 에러 ----------

// data.go.kr 공통 에러코드. 실호출로 검증 필요(키 발급 전 작성).
// 특히 22(트래픽 초과)와 30/31/32(키 문제)는 재시도해도 소용없으므로 구분한다.
const RESULT_CODE = {
  QUOTA_EXCEEDED: "22", // LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS
  KEY_UNREGISTERED: "30",
  KEY_EXPIRED: "31",
  IP_UNREGISTERED: "32",
  ACCESS_DENIED: "20",
};

class TourApiError extends Error {
  constructor(message, { code = null, operation = null, retryable = false } = {}) {
    super(message);
    this.name = "TourApiError";
    this.code = code;
    this.operation = operation;
    this.retryable = retryable;
  }

  // 일일 트래픽 소진. 호출부는 이걸 보고 즉시 중단하고 mock/캐시로 후퇴해야 한다.
  get isQuotaExceeded() {
    return this.code === RESULT_CODE.QUOTA_EXCEEDED;
  }

  // 인증키 자체의 문제. 재시도·후퇴가 아니라 설정을 고쳐야 한다.
  get isAuthError() {
    return [
      RESULT_CODE.KEY_UNREGISTERED,
      RESULT_CODE.KEY_EXPIRED,
      RESULT_CODE.IP_UNREGISTERED,
      RESULT_CODE.ACCESS_DENIED,
    ].includes(this.code);
  }
}

// ---------- 모드 / 호출 통계 ----------

// mock 으로 자동 전환됐을 때 그 사실을 한 번은 반드시 알린다.
// 조용히 mock 으로 떨어지면 가짜 데이터가 실측인 것처럼 문서·DB 로 흘러간다.
let warnedAutoMock = false;

function getSourceMode() {
  if (process.env.POI_SOURCE_MODE === "live") return { mock: false, reason: "POI_SOURCE_MODE=live" };
  if (process.env.POI_SOURCE_MODE === "mock") return { mock: true, reason: "POI_SOURCE_MODE=mock" };

  // 모드 미지정이면 키 유무로 자동 판단 — 여기가 사고 나는 자리다.
  if (!process.env.TOUR_API_KEY) {
    if (!warnedAutoMock) {
      warnedAutoMock = true;
      console.warn(
        "[tourApi] ⚠ POI_SOURCE_MODE 미지정 + TOUR_API_KEY 없음 → mock 데이터로 자동 전환합니다. " +
          "이 실행의 결과는 실측이 아닙니다."
      );
    }
    return { mock: true, reason: "auto: TOUR_API_KEY 없음" };
  }
  return { mock: false, reason: "auto: TOUR_API_KEY 있음" };
}

function isMockMode() {
  return getSourceMode().mock;
}

// 개발계정 쿼터가 일 1,000회로 알려져 있어(미검증) 소비량을 추적한다.
// 파이프라인 trace 에 실어 관리자 화면에서 확인할 수 있게 한다.
let callStats = { total: 0, byOperation: {}, failed: 0 };

function recordCall(operation, ok) {
  callStats.total += 1;
  callStats.byOperation[operation] = (callStats.byOperation[operation] || 0) + 1;
  if (!ok) callStats.failed += 1;
}

function getCallStats() {
  return { ...callStats, byOperation: { ...callStats.byOperation } };
}

function resetCallStats() {
  callStats = { total: 0, byOperation: {}, failed: 0 };
}

// ---------- 요청 ----------

// data.go.kr 인증키는 Encoding/Decoding 두 형태로 발급된다.
// 이미 인코딩된 키(%2B 등 포함)면 그대로, 아니면 encodeURIComponent 적용.
function normalizeServiceKey(rawKey) {
  if (!rawKey) return "";
  return /%[0-9A-Fa-f]{2}/.test(rawKey) ? rawKey : encodeURIComponent(rawKey);
}

function buildUrl(operation, params) {
  // 값이 비어 있는 파라미터는 아예 빼야 한다. TourAPI 는 빈 값에 민감하다.
  const cleaned = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    cleaned[key] = String(value);
  }

  const search = new URLSearchParams({
    MobileOS: "ETC",
    MobileApp: "GrandmaTour",
    _type: "json",
    ...cleaned,
  });

  // serviceKey 는 이미 인코딩된 상태이므로 URLSearchParams 에 넣으면 이중 인코딩된다.
  const serviceKey = normalizeServiceKey(process.env.TOUR_API_KEY);
  return `${BASE_URL}/${operation}?serviceKey=${serviceKey}&${search.toString()}`;
}

async function requestOnce(operation, params) {
  const url = buildUrl(operation, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();

    // TourAPI 는 에러 시 JSON 이 아니라 XML(OpenAPI_ServiceResponse)이나
    // HTML 을 돌려주는 경우가 있다. 그대로 JSON.parse 하면 엉뚱한 에러가 난다.
    if (text.trim().startsWith("<")) {
      // XML 안에 들어 있는 에러코드를 최대한 건져낸다.
      const codeMatch = /<returnReasonCode>(\d+)<\/returnReasonCode>/.exec(text);
      const code = codeMatch ? codeMatch[1] : null;
      throw new TourApiError(
        `TourAPI 비정상 응답(XML/HTML): ${text.slice(0, 200)}`,
        { code, operation, retryable: res.status >= 500 }
      );
    }

    const json = JSON.parse(text);

    // 응답에 에러코드가 실리는 위치가 두 가지다.
    //   정상 규격: { response: { header: { resultCode, resultMsg } } }
    //   파라미터 오류(KorService2 실측):
    //     { responseTime, resultCode: "10", resultMsg: "INVALID_REQUEST_PARAMETER_ERROR(listYN)" }
    // 후자를 안 보면 모든 파라미터 오류가 "0건 수집"으로 조용히 위장된다.
    const header = json?.response?.header;
    const code = header?.resultCode ?? json?.resultCode;
    const message = header?.resultMsg ?? json?.resultMsg;

    // 성공 코드는 서비스에 따라 "0000" 또는 "00" 으로 온다.
    if (code != null && code !== "0000" && code !== "00") {
      throw new TourApiError(`TourAPI 오류 [${code}] ${message || ""}`, {
        code: String(code),
        operation,
        retryable: false,
      });
    }

    // 코드도 없고 body 도 없으면 규격을 벗어난 응답이다. 빈 결과로 넘기면 안 된다.
    if (code == null && json?.response?.body === undefined) {
      throw new TourApiError(
        `TourAPI 알 수 없는 응답 형식(${operation}): ${text.slice(0, 200)}`,
        { operation, retryable: false }
      );
    }

    return json;
  } catch (err) {
    if (err instanceof TourApiError) throw err;
    // 네트워크 실패·타임아웃·JSON 파싱 실패는 일시적일 수 있으므로 재시도 대상.
    throw new TourApiError(`TourAPI 요청 실패(${operation}): ${err.message}`, {
      operation,
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson(operation, params) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
    try {
      const json = await requestOnce(operation, params);
      recordCall(operation, true);
      return json;
    } catch (err) {
      lastErr = err;
      recordCall(operation, false);
      // 쿼터 소진·인증 문제는 재시도해도 같은 결과다. 즉시 던진다.
      if (!err.retryable || err.isQuotaExceeded || err.isAuthError) throw err;
    }
  }
  throw lastErr;
}

// items.item 을 항상 배열로 정규화한다. 아이템 내부는 손대지 않는다.
// 응답이 비면 TourAPI 는 items 를 빈 문자열("")로 주기도 한다.
function extractItems(json) {
  const item = json?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function extractTotalCount(json) {
  return Number(json?.response?.body?.totalCount || 0);
}

// ---------- 코드 조회 ----------

// 시도/시군구 목록 (areaCode2). areaCode 를 주면 해당 시도의 시군구 목록.
async function getAreaCodes({ areaCode, numOfRows = 50, pageNo = 1 } = {}) {
  // areaCode 를 안 주면 시도 목록, 주면 그 시도의 시군구 목록이다.
  // mock 경로도 두 경우를 모두 덮어야 한다. 예전엔 시도 목록 mock 이 없어
  // controller 가 mockData.AREA_LIST 를 직접 꺼내 쓰면서 live 모드에도 섞여 나갔다.
  if (isMockMode()) {
    return areaCode ? getMockSigunguList(areaCode) : getMockAreaList();
  }

  const json = await requestJson("areaCode2", {
    numOfRows,
    pageNo,
    areaCode,
  });
  return extractItems(json);
}

// 분류체계 코드 조회 (categoryCode2).
// cat1 만 주면 cat2 목록, cat1+cat2 를 주면 cat3 목록이 나온다.
//
// **키 발급 후 첫 작업이 이 함수로 cat1/2/3 트리 전문을 받아내는 것이다.**
// 리서치 2회 모두 코드표를 확보하지 못해, keywordMapper 의 매핑표를
// 여기서 받은 실제 코드로 작성해야 한다. (docs/poi-selection-spec.md STEP 4)
async function getCategoryCodes({ cat1, cat2, cat3, contentTypeId, numOfRows = 100 } = {}) {
  if (isMockMode()) return [];

  const json = await requestJson("categoryCode2", {
    numOfRows,
    pageNo: 1,
    contentTypeId,
    cat1,
    cat2,
    cat3,
  });
  return extractItems(json);
}

// ---------- POI 목록 ----------

// 지역기반 관광정보 목록 (areaBasedList2).
// contentTypeId 별로 페이지를 순회하며 원본 아이템을 모아 준다.
async function getAreaPois({
  areaCode,
  sigunguCode,
  contentTypeIds = [12, 14, 15, 25, 28, 38, 39],
  numOfRows = 100,
  maxPages = 3,
  arrange = "C", // C: 수정일순(대표이미지 있는 항목 우선)
} = {}) {
  if (isMockMode()) {
    return getMockAreaBasedList({ areaCode, sigunguCode, contentTypeIds });
  }

  const collected = [];
  for (const contentTypeId of contentTypeIds) {
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      // listYN 은 KorService1 파라미터다. KorService2 에 넘기면
      // resultCode 10 INVALID_REQUEST_PARAMETER_ERROR 로 거부된다.
      const json = await requestJson("areaBasedList2", {
        numOfRows,
        pageNo,
        arrange,
        areaCode,
        sigunguCode,
        contentTypeId,
      });

      collected.push(...extractItems(json));

      if (pageNo * numOfRows >= extractTotalCount(json)) break;
    }
  }
  return collected;
}

// 위치기반 관광정보 목록 (locationBasedList2).
// 중심좌표 + 반경으로 조회하므로 하버사인 필터링이 불필요하고,
// 응답에 중심까지의 거리(dist, 미터)가 포함된다 — 단 미검증. (spec STEP 2)
//
// radius 단위는 미터. 상한 20km 로 알려져 있으나 역시 미검증이다.
async function getLocationPois({
  lat,
  lon,
  radiusM = 2500,
  contentTypeIds = [12, 14, 28, 39],
  numOfRows = 100,
  maxPages = 3,
  arrange = "E", // E: 거리순
} = {}) {
  if (isMockMode()) {
    return getMockAreaBasedList({ contentTypeIds });
  }

  const collected = [];
  for (const contentTypeId of contentTypeIds) {
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const json = await requestJson("locationBasedList2", {
        numOfRows,
        pageNo,
        arrange,
        mapX: lon, // TourAPI 는 mapX=경도, mapY=위도
        mapY: lat,
        radius: Math.round(radiusM),
        contentTypeId,
      });

      collected.push(...extractItems(json));

      if (pageNo * numOfRows >= extractTotalCount(json)) break;
    }
  }
  return collected;
}

// ---------- 상세 조회 ----------

// 공통 상세정보 (detailCommon2): 개요(overview), 좌표, 주소 등
async function getDetailCommon(contentId) {
  if (isMockMode()) return null;

  // KorService1 의 YN 플래그(defaultYN/overviewYN/mapinfoYN …)는 KorService2 에서
  // 제거됐다. 넘기면 resultCode 10 INVALID_REQUEST_PARAMETER_ERROR 로 거부된다.
  // 플래그 없이 부르면 개요·좌표·주소가 모두 포함돼 온다. (2026-08-13 실호출 확인)
  const json = await requestJson("detailCommon2", { contentId });
  return extractItems(json)[0] || null;
}

// 소개정보 (detailIntro2): 이용시간(usetime), 휴무일(restdate), 주차(parking) 등
// contentTypeId 별로 제공 필드가 다르므로 반드시 함께 넘겨야 한다.
async function getDetailIntro(contentId, contentTypeId) {
  if (isMockMode()) return null;

  const json = await requestJson("detailIntro2", {
    contentId,
    contentTypeId,
  });
  return extractItems(json)[0] || null;
}

// 반복정보 (detailInfo2): 코스 구성, 부대시설 등 항목이 여러 건 나올 수 있어
// 배열 그대로 반환한다.
async function getDetailInfo(contentId, contentTypeId) {
  if (isMockMode()) return [];

  const json = await requestJson("detailInfo2", {
    contentId,
    contentTypeId,
  });
  return extractItems(json);
}

// 이미지정보 (detailImage2): originimgurl 등. 대표성 지표의 보조 신호로 쓴다.
async function getDetailImages(contentId) {
  if (isMockMode()) return [];

  const json = await requestJson("detailImage2", {
    contentId,
    imageYN: "Y",
  });
  return extractItems(json);
}

module.exports = {
  // 모드 · 통계
  isMockMode,
  getSourceMode,
  getCallStats,
  resetCallStats,

  // 코드 조회
  getAreaCodes,
  getCategoryCodes,

  // POI 목록
  getAreaPois,
  getLocationPois,

  // 상세
  getDetailCommon,
  getDetailIntro,
  getDetailInfo,
  getDetailImages,

  // 유틸 · 에러
  extractItems,
  TourApiError,
  RESULT_CODE,
};
