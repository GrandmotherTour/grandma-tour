// TourAPI 원본 응답 → 우리 POI 형식으로 통일
//
// ── 이 파일의 책임 범위 ──────────────────────────────────────────────
// 구조 변환만 한다. 필드명을 우리 이름으로 바꾸고, 타입을 맞추고,
// 여러 응답(목록 + detailCommon + detailIntro + 무장애)을 POI 하나로 합친다.
//
// 판단은 하지 않는다:
//   - 운영시간 문자열 파싱 → operatingHoursParser
//   - 체류시간 결정        → durationResolver
//   - 키워드 부여          → keywordMapper
// 위 세 값의 자리(open_windows / duration_min / keywords)는 만들어 두되
// null 로 비워서 넘긴다. 뒤 단계가 채우고 sources 에 근거를 남긴다.
//
// 이 파일이 있는 이유: 이후 코드가 TourAPI 의 필드명을 몰라도 되게 하기 위해서다.

// ---------- detailIntro2 필드명 대응표 ----------
//
// **중요**: detailIntro2 는 contentTypeId 마다 필드명이 다르다.
// 관광지는 usetime 이지만 문화시설은 usetimeculture, 음식점은 opentimefood 다.
// (기존 controller.js 는 `intro.usetime || intro.opentime` 만 봤기 때문에
//  문화시설·레포츠·음식점의 운영시간을 단 한 건도 읽지 못하고 있었다.)
//
// 미검증 — 키 발급 후 실제 응답으로 필드명을 확인할 것.
const INTRO_FIELDS = {
  12: {
    // 관광지
    useTime: "usetime",
    restDate: "restdate",
    parking: "parking",
    babyCarriage: "chkbabycarriage",
    pet: "chkpet",
    infoCenter: "infocenter",
  },
  14: {
    // 문화시설
    useTime: "usetimeculture",
    restDate: "restdateculture",
    parking: "parkingculture",
    babyCarriage: "chkbabycarriageculture",
    pet: "chkpetculture",
    infoCenter: "infocenterculture",
  },
  15: {
    // 축제/공연/행사
    useTime: "playtime",
    restDate: null,
    parking: "parkingfestival",
    babyCarriage: null,
    pet: null,
    infoCenter: "sponsor1tel",
  },
  25: {
    // 여행코스
    useTime: null,
    restDate: null,
    parking: null,
    babyCarriage: null,
    pet: null,
    infoCenter: "infocentertourcourse",
  },
  28: {
    // 레포츠
    useTime: "usetimeleports",
    restDate: "restdateleports",
    parking: "parkingleports",
    babyCarriage: "chkbabycarriageleports",
    pet: "chkpetleports",
    infoCenter: "infocenterleports",
  },
  38: {
    // 쇼핑
    useTime: "opentimeshopping",
    restDate: "restdateshopping",
    parking: "parkingshopping",
    babyCarriage: "chkbabycarriageshopping",
    pet: "chkpetshopping",
    infoCenter: "infocentershopping",
  },
  39: {
    // 음식점 — usetime 이 아니라 opentimefood 다
    useTime: "opentimefood",
    restDate: "restdatefood",
    parking: "parkingfood",
    babyCarriage: null,
    pet: null,
    infoCenter: "infocenterfood",
  },
};

// ---------- 값 정리 유틸 ----------

function text(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

// TourAPI 는 값이 없을 때 빈 문자열을 주므로, 빈 문자열은 null 로 통일한다.
function textOrNull(value) {
  const t = text(value);
  return t === "" ? null : t;
}

function numberOrNull(value) {
  const t = text(value);
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// overview 등에는 <br>, <p> 같은 태그와 &nbsp; 가 섞여 온다.
function stripHtml(value) {
  const t = text(value);
  if (t === "") return null;
  return (
    t
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/[ \t]+/g, " ")
      .trim() || null
  );
}

// "있음" / "없음" / "가능" / "불가" 같은 자유 텍스트를 3값으로 정리한다.
// 판정이 애매하면 원문을 살려 두도록 null 을 준다(뒤 단계가 원문을 볼 수 있게).
function toTriState(value) {
  const t = text(value);
  if (t === "") return null;
  if (/(불가|없음|미제공|불가능|없습니다)/.test(t)) return false;
  if (/(가능|있음|possible|available|무료|유료|주차장)/i.test(t)) return true;
  return null;
}

// ---------- 목록 아이템 정규화 ----------

// areaBasedList2 / locationBasedList2 의 아이템 하나를 POI 로 만든다.
// 좌표: TourAPI 는 mapx=경도(lon), mapy=위도(lat) 다. 뒤집으면 조용히 틀린다.
function normalizeListItem(raw, { source = "areaBasedList2" } = {}) {
  if (!raw) return null;

  const contentId = textOrNull(raw.contentid);
  if (!contentId) return null;

  return {
    content_id: contentId,
    content_type_id: numberOrNull(raw.contenttypeid),
    title: text(raw.title),

    // 분류체계 두 벌을 모두 보관한다. 키워드 매핑은 신 분류를 1차,
    // 구 분류를 보조로 쓰며(docs/keyword-mapping-facts.md §B-2),
    // 매핑 규칙을 나중에 바꿀 때 원본 코드가 남아 있어야 재적용할 수 있다.
    cat1: textOrNull(raw.cat1),
    cat2: textOrNull(raw.cat2),
    cat3: textOrNull(raw.cat3),

    // KorService2 신규 분류. 목록·상세 응답 모두에 온다.
    lcls_systm1: textOrNull(raw.lclsSystm1),
    lcls_systm2: textOrNull(raw.lclsSystm2),
    lcls_systm3: textOrNull(raw.lclsSystm3),

    latitude: numberOrNull(raw.mapy),
    longitude: numberOrNull(raw.mapx),
    // locationBasedList2 만 주는 중심까지의 거리(미터)
    distance_m: numberOrNull(raw.dist),

    address: [textOrNull(raw.addr1), textOrNull(raw.addr2)]
      .filter(Boolean)
      .join(" ") || null,
    tel: textOrNull(raw.tel),

    image_url: textOrNull(raw.firstimage),
    image_thumb_url: textOrNull(raw.firstimage2),
    image_count: null, // detailImage2 로 채움

    area_code: textOrNull(raw.areacode),
    sigungu_code: textOrNull(raw.sigungucode),

    description: null, // detailCommon2 로 채움

    // ── 뒤 단계가 채우는 자리 ──
    open_windows: null, // operatingHoursParser
    rest_days: null, // operatingHoursParser
    duration_min: null, // durationResolver

    // keywordMapper — 관광 선호는 단일 카테고리, 운영 조건과 섞지 않는다
    preference_category: null,
    mapping_status: null, // mapped | unmapped | no_code
    classification_source: null, // lclsSystm3 | cat3
    classification_code: null,
    poi_role: null, // GUIDE_HUB | ROUTE_STOP

    // ── 접근성 (detailIntro2 + 무장애 API) ──
    accessibility: {
      parking: null,
      baby_carriage: null,
      pet: null,
      wheelchair: null,
      barrier_free: null,
    },

    // ── 근거 추적 ──
    // 각 값이 어디서 왔는지 남긴다. 폴백을 썼는지 화면·로그에서 구분하기 위한 것.
    sources: {
      base: source,
      detail_common: null,
      detail_intro: null,
      detail_images: null,
      accessibility: null,
      hours: null,
      duration: null,
      keywords: null,
    },

    // 원본 보관. 디버깅과, 아직 안 쓰는 필드를 나중에 꺼내 쓰기 위해.
    raw: { list: raw },
  };
}

// ---------- 상세 응답 병합 ----------

// detailCommon2 → 개요, 좌표 보정
function mergeDetailCommon(poi, common) {
  if (!poi || !common) return poi;

  poi.description = stripHtml(common.overview) || poi.description;
  poi.title = poi.title || text(common.title);
  poi.image_url = poi.image_url || textOrNull(common.firstimage);
  poi.image_thumb_url = poi.image_thumb_url || textOrNull(common.firstimage2);

  // 목록에 좌표가 없던 POI 를 상세로 보정할 수 있다.
  if (poi.latitude == null) poi.latitude = numberOrNull(common.mapy);
  if (poi.longitude == null) poi.longitude = numberOrNull(common.mapx);

  if (!poi.address) {
    poi.address =
      [textOrNull(common.addr1), textOrNull(common.addr2)]
        .filter(Boolean)
        .join(" ") || null;
  }

  poi.sources.detail_common = "detailCommon2";
  poi.raw.common = common;
  return poi;
}

// detailIntro2 → 운영시간 원문, 휴무일 원문, 주차/유모차/반려동물
// **파싱은 하지 않는다.** 원문 문자열을 꺼내 자리에 놓기만 한다.
function mergeDetailIntro(poi, intro) {
  if (!poi || !intro) return poi;

  const fields = INTRO_FIELDS[poi.content_type_id];
  if (!fields) {
    // 대응표에 없는 contentTypeId. 값을 지어내지 않고 원본만 남긴다.
    poi.sources.detail_intro = `detailIntro2(unmapped:${poi.content_type_id})`;
    poi.raw.intro = intro;
    return poi;
  }

  // 운영시간·휴무일은 자유 텍스트 원문 그대로 보관 → operatingHoursParser 가 해석
  poi.use_time_raw = fields.useTime ? textOrNull(intro[fields.useTime]) : null;
  poi.rest_date_raw = fields.restDate ? textOrNull(intro[fields.restDate]) : null;

  poi.accessibility.parking = fields.parking
    ? toTriState(intro[fields.parking])
    : null;
  poi.accessibility.baby_carriage = fields.babyCarriage
    ? toTriState(intro[fields.babyCarriage])
    : null;
  poi.accessibility.pet = fields.pet ? toTriState(intro[fields.pet]) : null;

  // 주차 원문도 남긴다("주차 가능(30대)" 같은 정보가 3값으로 뭉개지므로)
  poi.parking_raw = fields.parking ? textOrNull(intro[fields.parking]) : null;
  poi.info_center = fields.infoCenter ? textOrNull(intro[fields.infoCenter]) : null;

  poi.sources.detail_intro = `detailIntro2(type:${poi.content_type_id})`;
  poi.raw.intro = intro;
  return poi;
}

// detailImage2 → 이미지 개수 (대표성 지표의 보조 신호)
function mergeDetailImages(poi, images) {
  if (!poi || !Array.isArray(images)) return poi;

  poi.image_count = images.length;
  if (!poi.image_url && images.length > 0) {
    poi.image_url = textOrNull(images[0].originimgurl);
  }

  poi.sources.detail_images = "detailImage2";
  poi.raw.images = images;
  return poi;
}

// 무장애 여행정보 (withTourApiClient) → 휠체어·무장애 정보
// withTourApiClient 를 아직 안 만들었으므로 형태만 잡아 둔다.
// 실제 응답 필드명은 그 파일을 만들 때 확정한다.
function mergeAccessibility(poi, info) {
  if (!poi || !info) return poi;

  poi.accessibility.wheelchair = toTriState(
    info.wheelchair ?? info.exit ?? info.publictransport
  );
  poi.accessibility.barrier_free = true;

  poi.sources.accessibility = "KorWithService";
  poi.raw.accessibility = info;
  return poi;
}

// ---------- 한 번에 ----------

// 여러 응답을 받아 POI 하나로 합친다.
function normalizePoi({
  listItem,
  common = null,
  intro = null,
  images = null,
  accessibility = null,
  source = "areaBasedList2",
} = {}) {
  const poi = normalizeListItem(listItem, { source });
  if (!poi) return null;

  if (common) mergeDetailCommon(poi, common);
  if (intro) mergeDetailIntro(poi, intro);
  if (images) mergeDetailImages(poi, images);
  if (accessibility) mergeAccessibility(poi, accessibility);

  return poi;
}

// 목록 응답 전체를 정규화한다.
// 좌표 없음/중복 제거 같은 "판단"은 여기서 하지 않는다 — 파이프라인 정제 단계의 몫.
// contentid 조차 없는 아이템만 걸러낸다(POI 로 성립하지 않으므로).
function normalizeList(rawItems, { source = "areaBasedList2" } = {}) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((raw) => normalizeListItem(raw, { source }))
    .filter(Boolean);
}

module.exports = {
  normalizeList,
  normalizeListItem,
  normalizePoi,
  mergeDetailCommon,
  mergeDetailIntro,
  mergeDetailImages,
  mergeAccessibility,

  // 테스트·후속 모듈용
  INTRO_FIELDS,
  stripHtml,
  toTriState,
};
