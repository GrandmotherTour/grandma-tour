// POI 관광 선호 카테고리 매핑 — TourAPI 분류코드 기반
//
// ── 설계 원칙 (docs/keyword-mapping-facts.md §B) ──────────────────
// 1. 관광 선호와 운영 조건을 **섞지 않는다.**
//    preference_category = 관광객이 선호를 표현하는 축 (설문과 같은 어휘)
//    operability          = 어르신 가이드가 상주 가능한지 판단하는 별도 정보
//    화장실·착석·실내·접근성은 여기서 다루지 않는다.
//
// 2. 코드 하나에 **주 카테고리 하나만** 붙인다. (1:1)
//    사찰 → 역사·문화. "역사 + 실내 + 조용함" 처럼 겹쳐 붙이면
//    해당 POI 의 매칭 점수가 부당하게 높아진다.
//
// 3. 신 분류(lclsSystm) 1차, 구 분류(cat) 보조.
//    둘 다 실패하면 억지로 매핑하지 않고 unmapped 로 둔다.
//
// 4. 매핑 실패가 POI 탈락을 뜻하지 않는다.
//    거점 후보로는 남되 선호 매칭에서 카테고리 보너스를 받지 않을 뿐이다.
//
// ── 매핑 단위 ────────────────────────────────────────────────────
// 3단계 코드는 246종(신) / 153종(구)이라 전수 매핑하면 유지가 안 된다.
// **2단계 코드에 매핑하고, 필요한 경우에만 3단계로 덮는다.**
// "기타~" 로 끝나는 분류는 성격이 불명확하므로 의도적으로 매핑하지 않는다.

const CODE_TABLE = require("./data/categoryCodes.json");

// 사용자 설문과 공유하는 어휘. 이 다섯 개가 전부다.
//
// `경관·사진` 은 어휘에서 제외했다. 나머지 다섯은 분류코드에서 바로 유도되는데
// "사진 찍기 좋은 곳"만 유도되지 않는다 — 분류 축이 아니라 장소의 성질이라
// 코드에 표현돼 있지 않다. 유일한 후보였던 VE01 랜드마크관광은 실제로는
// 건물·타워·다리·동상 같은 인공 구조물이라 역사·문화가 맞다.
// (docs/keyword-mapping-facts.md §D-1)
const PREFERENCE_CATEGORIES = Object.freeze([
  "자연",
  "역사·문화",
  "시장·지역생활",
  "음식",
  "체험",
]);

const ROLE = Object.freeze({ GUIDE_HUB: "GUIDE_HUB", ROUTE_STOP: "ROUTE_STOP" });

// ---------- 신 분류 (lclsSystm) — 1차 기준 ----------

// 2단계 코드 → 관광 선호 카테고리.
// 값이 null 인 항목은 "일부러 매핑하지 않음" 이다. 지우지 말 것 —
// 빠뜨린 것과 판단해서 뺀 것을 구분하기 위해 명시적으로 남긴다.
const LCLS_L2_MAP = Object.freeze({
  // 자연관광
  NA01: "자연", // 자연경관(산)
  NA02: "자연", // 자연경관(하천‧해양)
  NA03: "자연", // 자연생태
  NA04: "자연", // 자연공원 (지질공원 포함)
  NA05: null, // 기타자연관광 — 성격 불명

  // 역사관광
  HS01: "역사·문화", // 역사유적지
  HS02: "역사·문화", // 역사유물
  HS03: "역사·문화", // 종교성지
  HS04: "역사·문화", // 안보관광지

  // 체험관광
  EX01: "체험", // 전통체험
  EX02: "체험", // 공예체험
  EX03: "체험", // 농.산.어촌 체험
  EX04: "체험", // 산사체험
  EX05: "체험", // 웰니스관광
  EX06: "체험", // 산업관광
  EX07: null, // 기타체험 — 성격 불명

  // 음식
  FD01: "음식", // 한식
  FD02: "음식", // 외국식
  FD03: "음식", // 간이음식
  FD04: "음식", // 주점
  FD05: "음식", // 카페/찻집

  // 쇼핑 — [검토필요] 아래 §검토 참조
  SH01: "시장·지역생활", // 백화점
  SH02: "시장·지역생활", // 쇼핑몰
  SH03: "시장·지역생활", // 대형마트
  SH04: "시장·지역생활", // 면세점
  SH05: "시장·지역생활", // 전문매장/상가
  SH06: "시장·지역생활", // 시장
  SH07: null, // 기타쇼핑시설 — 성격 불명

  // 문화관광
  // VE01 하위는 건물/타워·전망대/다리/분수/동상/터널/댐/등대 — 인공 구조물이다.
  // 구 분류의 A0205 건축/조형물과 같은 성격이라 역사·문화로 맞춘다.
  VE01: "역사·문화", // 랜드마크관광
  VE02: "체험", // 테마공원      [검토필요]
  VE03: "자연", // 도시공원      [검토필요]
  VE04: "역사·문화", // 도시.지역문화관광
  VE05: null, // 복합관광시설 — 성격 불명
  VE06: "역사·문화", // 공연시설
  VE07: "역사·문화", // 전시시설
  VE08: null, // 행사시설 — 성격 불명
  VE09: "역사·문화", // 교육시설 (문화전수시설 등)
  VE10: "체험", // 레저스포츠시설
  VE11: null, // 교통시설 — 관광 선호 축이 아님
  VE12: null, // 기타문화관광지 — 성격 불명

  // 축제/공연/행사 — [검토필요]
  EV01: "체험", // 축제
  EV02: "역사·문화", // 공연
  EV03: "체험", // 행사

  // 레저스포츠 — [검토필요]
  LS01: "체험", // 육상레저스포츠
  LS02: "체험", // 수상레저스포츠
  LS03: "체험", // 항공레저스포츠
  LS04: "체험", // 복합레저스포츠

  // 숙박·추천코스 — 관광 선호 축이 아니다
  AC01: null,
  AC02: null,
  AC03: null,
  AC04: null,
  AC05: null,
  AC06: null,
});

// 3단계 덮어쓰기. 2단계 규칙으로는 성격이 어긋나는 개별 코드만.
const LCLS_L3_OVERRIDE = Object.freeze({
  // 시장은 쇼핑 중에서도 '지역생활' 성격이 가장 뚜렷하다. 명시적으로 고정.
  SH060100: "시장·지역생활",
});

// ---------- 구 분류 (cat) — 보조 기준 ----------

const CAT_L2_MAP = Object.freeze({
  A0101: "자연", // 자연관광지
  A0102: "자연", // 관광자원

  A0201: "역사·문화", // 역사관광지
  A0202: "자연", // 휴양관광지 (공원·자연휴양림)  [검토필요]
  A0203: "체험", // 체험관광지
  A0204: "체험", // 산업관광지
  A0205: "역사·문화", // 건축/조형물
  A0206: "역사·문화", // 문화시설
  A0207: "체험", // 축제
  A0208: "역사·문화", // 공연/행사

  A0301: null, // 레포츠소개 — POI 가 아님
  A0302: "체험", // 육상 레포츠
  A0303: "체험", // 수상 레포츠
  A0304: "체험", // 항공 레포츠
  A0305: "체험", // 복합 레포츠

  A0401: "시장·지역생활", // 쇼핑
  A0502: "음식", // 음식점

  B0201: null, // 숙박시설
});

const CAT_L3_OVERRIDE = Object.freeze({});

// ---------- 거점 역할 (poi_role) ----------
//
// 음식점은 기본적으로 GUIDE_HUB 이 아니다. 별도 영업 주체가 있어
// 업주 협의·영업시간·좌석 점유·휴무 같은 운영 제약이 붙는다.
// 코스에는 넣되 가이드 상주 거점으로는 쓰지 않는다.
// 실제 협약이 된 곳만 관리자가 GUIDE_HUB 으로 승격한다.
const ROUTE_STOP_LCLS_L1 = new Set(["FD", "AC"]); // 음식, 숙박
const ROUTE_STOP_CAT1 = new Set(["A05", "B02"]);

/**
 * 이 POI 가 가이드 상주 거점이 될 수 있는 성격인지.
 * 관리자 승격은 이 판정 위에 덮어쓰는 별도 절차다(미구현).
 */
function resolveRole(poi) {
  const l1 = poi?.lcls_systm1 || poi?.raw?.common?.lclsSystm1 || null;
  const c1 = poi?.cat1 || null;

  if (l1 && ROUTE_STOP_LCLS_L1.has(l1)) return ROLE.ROUTE_STOP;
  if (!l1 && c1 && ROUTE_STOP_CAT1.has(c1)) return ROLE.ROUTE_STOP;
  return ROLE.GUIDE_HUB;
}

// ---------- 코드 해석 ----------

function lclsCode(poi) {
  return poi?.lcls_systm3 || poi?.raw?.common?.lclsSystm3 || null;
}

function catCode(poi) {
  return poi?.cat3 || null;
}

/** 코드를 사람이 읽는 분류 경로로. 매핑 여부와 무관하게 항상 동작한다. */
function describeCode(code, taxonomy) {
  if (!code) return null;

  if (taxonomy === "cat3") {
    const hit = CODE_TABLE.cat3[code];
    if (!hit) return { code, taxonomy, label: `(코드표에 없음: ${code})` };
    return { code, taxonomy, label: [hit.cat1Name, hit.cat2Name, hit.name].join(" > ") };
  }

  const hit = CODE_TABLE.lclsSystm3[code];
  if (!hit) return { code, taxonomy, label: `(코드표에 없음: ${code})` };
  return { code, taxonomy, label: [hit.l1Name, hit.l2Name, hit.name].join(" > ") };
}

/**
 * "기타~" 로 시작하는 3단계 분류는 매핑하지 않는다. (B-4)
 *
 * 분류기가 상위 항목에 못 넣어 남긴 자리라 실제 내용이 무엇인지 알 수 없다.
 * 상위 2단계(예: 역사유적지)가 방향을 알려주긴 하지만, 그 신뢰로 카테고리
 * 보너스를 주면 검증되지 않은 매칭이 된다. 상세설명 분석이나 관리자 검수로 보완한다.
 *
 * **두 체계 모두에 적용한다.** 신 분류에서만 막으면 구 분류 폴백이 되살린다.
 */
function isCatchAllName(name) {
  return typeof name === "string" && /^기타/.test(name.trim());
}

// 3단계 코드 하나를 카테고리로. 못 정하면 null.
function categoryOf(code, taxonomy) {
  if (!code) return null;

  if (taxonomy === "cat3") {
    if (code in CAT_L3_OVERRIDE) return CAT_L3_OVERRIDE[code];
    if (isCatchAllName(CODE_TABLE.cat3[code]?.name)) return null;
    return CAT_L2_MAP[code.slice(0, 5)] ?? null;
  }

  if (code in LCLS_L3_OVERRIDE) return LCLS_L3_OVERRIDE[code];
  if (isCatchAllName(CODE_TABLE.lclsSystm3[code]?.name)) return null;
  return LCLS_L2_MAP[code.slice(0, 4)] ?? null;
}

// ---------- 결정 ----------

/**
 * 관광 선호 카테고리를 결정한다.
 *
 * 우선순위 (docs/keyword-mapping-facts.md §B-2)
 *   1. 신 분류가 매핑되면 신 분류
 *   2. 아니면 구 분류가 매핑되면 구 분류
 *   3. 둘 다 실패하면 unmapped
 *
 * @returns {{category, status, source, code}}
 *   status: "mapped" | "unmapped" | "no_code"
 */
function resolvePreference(poi) {
  const lcls = lclsCode(poi);
  const cat = catCode(poi);

  const fromLcls = categoryOf(lcls, "lclsSystm3");
  if (fromLcls) {
    return { category: fromLcls, status: "mapped", source: "lclsSystm3", code: lcls };
  }

  const fromCat = categoryOf(cat, "cat3");
  if (fromCat) {
    return { category: fromCat, status: "mapped", source: "cat3", code: cat };
  }

  if (!lcls && !cat) {
    return { category: null, status: "no_code", source: null, code: null };
  }

  // 코드는 있는데 어느 표에도 안 걸렸다. 원본 코드를 남겨 나중에 재적용한다.
  return {
    category: null,
    status: "unmapped",
    source: lcls ? "lclsSystm3" : "cat3",
    code: lcls || cat,
  };
}

/** 정규화된 POI 에 카테고리·역할을 채운다. (poiNormalizer 가 비워 둔 자리) */
function applyKeywords(poi) {
  if (!poi) return poi;

  const { category, status, source, code } = resolvePreference(poi);

  poi.preference_category = category;
  poi.mapping_status = status;
  poi.classification_source = source;
  poi.classification_code = code;
  poi.poi_role = resolveRole(poi);
  poi.sources.keywords = status === "mapped" ? `mapped:${source}` : status;

  return poi;
}

/**
 * 매핑되지 않은 코드를 건수 순으로 모은다.
 * 매핑표를 보강할 때 이 출력이 그대로 작업 목록이 된다.
 */
function collectUnmappedCodes(pois) {
  const bucket = new Map();

  for (const poi of pois || []) {
    if (poi.mapping_status !== "unmapped") continue;

    const key = `${poi.classification_source}:${poi.classification_code}`;
    if (!bucket.has(key)) {
      bucket.set(key, {
        code: poi.classification_code,
        taxonomy: poi.classification_source,
        label: describeCode(poi.classification_code, poi.classification_source)?.label || null,
        count: 0,
        examples: [],
      });
    }
    const entry = bucket.get(key);
    entry.count += 1;
    if (entry.examples.length < 3) entry.examples.push(poi.title);
  }

  return [...bucket.values()].sort((a, b) => b.count - a.count);
}

module.exports = {
  applyKeywords,
  resolvePreference,
  resolveRole,
  collectUnmappedCodes,
  describeCode,
  categoryOf,
  isCatchAllName,
  lclsCode,
  catCode,

  PREFERENCE_CATEGORIES,
  ROLE,
  LCLS_L2_MAP,
  CAT_L2_MAP,
  CODE_TABLE,
};
