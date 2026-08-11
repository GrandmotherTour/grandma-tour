// 카카오맵 로컬 REST API 클라이언트
//
// 용도: (1) 지역명 → 중심좌표 지오코딩, (2) POI 좌표 보정/검증,
//       (3) 키워드 검색으로 누락 좌표 채우기
// 인증: 헤더 Authorization: KakaoAK {REST_API_KEY}
// 키 발급: https://developers.kakao.com → 앱 생성 → REST API 키
//
// 키가 없으면 좌표 보정은 건너뛰고 원본 좌표를 그대로 사용한다(mock-safe).

const KAKAO_BASE = "https://dapi.kakao.com/v2/local";
const DEFAULT_TIMEOUT_MS = Number(process.env.KAKAO_TIMEOUT_MS || 6000);

function hasKakaoKey() {
  return Boolean(process.env.KAKAO_REST_KEY) &&
    process.env.POI_SOURCE_MODE !== "mock";
}

async function kakaoGet(path, params) {
  const search = new URLSearchParams(params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${KAKAO_BASE}${path}?${search.toString()}`, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Kakao API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 지역명 → 중심좌표(lat/lon). 실패 시 null.
async function geocodeRegion(query) {
  if (!hasKakaoKey()) return null;
  try {
    const json = await kakaoGet("/search/keyword.json", {
      query,
      size: "1",
    });
    const doc = json?.documents?.[0];
    if (!doc) return null;
    return { lat: Number(doc.y), lon: Number(doc.x) };
  } catch (err) {
    console.warn("[kakao] geocodeRegion 실패:", err.message);
    return null;
  }
}

// 키워드로 좌표 조회 (POI 좌표 누락 보정용)
async function findCoordByKeyword(keyword) {
  if (!hasKakaoKey()) return null;
  try {
    const json = await kakaoGet("/search/keyword.json", {
      query: keyword,
      size: "1",
    });
    const doc = json?.documents?.[0];
    if (!doc) return null;
    return {
      lat: Number(doc.y),
      lon: Number(doc.x),
      roadAddress: doc.road_address_name || doc.address_name || null,
    };
  } catch (err) {
    console.warn("[kakao] findCoordByKeyword 실패:", err.message);
    return null;
  }
}

module.exports = {
  hasKakaoKey,
  geocodeRegion,
  findCoordByKeyword,
};
