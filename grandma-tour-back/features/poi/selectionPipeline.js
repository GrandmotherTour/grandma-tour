// 운영 거점 선정 파이프라인
//
// ── 이 파일이 답하는 질문 ────────────────────────────────────────
//   "이 지역에서 실제로 어떤 4~5곳에 가이드를 상주시킬 것인가"
//
// CP-SAT 이 답하는 질문("이 사용자가 어디를 어떤 순서로 갈 것인가")과 다르다.
// CP-SAT 은 입력을 **이미 가이드가 배치된 거점 집합**으로 전제하며,
// 그 집합을 만드는 것이 이 파일의 책임이다.
// 따라서 방문 순서·120분 예산 소진·사용자 선호 압축은 여기서 하지 않는다.
// (docs/poi-selection-refactor-inventory.md §0)
//
// ── 단계 ────────────────────────────────────────────────────────
//   1. 수집          TourAPI areaBasedList2
//   2. 정규화·정제    poiNormalizer + 중복 제거
//   3. 상세 보강      detailCommon/Intro → operatingHoursParser, durationResolver
//   4. 운영 후보 판정  valid / needs_review / unavailable
//   5. 이동시간 행렬   travelTimeService
//   6. 공간 구조 분석  ※ 판정하지 않는다. 분포만 관측한다.
//   7. 거점 4~5개 선정 ※ 미구현 — 선정 기준 미확정
//
// ── 필드 명명 ───────────────────────────────────────────────────
// 파이프라인 내부는 snake_case(DB 컬럼과 일치)를 쓴다.
// 화면·repository 가 쓰는 camelCase 로의 변환은 경계에서만 — toLegacyShape().
// (inventory §3, 결정 A)

const tourApi = require("./tourApiClient");
const poiNormalizer = require("./poiNormalizer");
const { applyOperatingHours } = require("./operatingHoursParser");
const { applyDuration } = require("./durationResolver");
const keywordMapper = require("./keywordMapper");
const hubSelector = require("./hubSelector");
const surveyPreference = require("./surveyPreference");

// 최소 이격 관측점(분). **어느 것도 정책이 아니다.**
// 이격 없이 최적화하면 거점 4곳이 같은 관광단지 안으로 수렴하는 것이 확인됐다
// (경주 보문단지 2분, 청송 읍내 1분 — observations §10).
// 15분 권역 기준을 정할 때처럼 분포를 보고 정한다.
const PROBE_SEPARATIONS_MIN = [0, 2, 3, 5, 7, 10];
const travelTime = require("./travelTimeService");
// mockData 는 import 하지 않는다. mock/live 분기는 tourApiClient 에서만 일어난다.

const CONTENT_TYPE_LABEL = {
  12: "관광지",
  14: "문화시설",
  15: "축제/행사",
  25: "여행코스",
  28: "레포츠",
  38: "쇼핑",
  39: "음식점",
};

// 권역 기준 — 두 POI 를 "같은 권역"으로 볼 이동시간 상한(분).
//
// **15분은 청송군 실측 분포에서 고른 값이다.** (docs/poi-selection-observations.md §3)
//   - 20분에서 청송 전체(47개)가 한 덩어리가 되어 구분력이 사라진다 → 상한
//   - 3분에서는 21덩어리로 부서지고 11개가 고립된다 → 하한
//   - 15분: 4덩어리, 최대 덩어리 39개, 이웃 3개 이상인 POI 44개
//     → 거점 4~5개 묶기가 성립하면서 지역이 구분되는 지점
//
// 제안서의 2.5km 는 40km/h 환산 시 약 4분으로, 너무 잘게 쪼개 거점을 정할 수 없었다.
const REGION_THRESHOLD_MIN = Number(process.env.POI_REGION_THRESHOLD_MIN || 15);

// STEP 6 에서 함께 찍어볼 관측점. 기준을 15분으로 정한 뒤에도 분포는 계속 본다
// — 다른 시군구에서 15분이 안 맞을 수 있고, 그때 이 표가 근거가 된다.
const PROBE_THRESHOLDS_MIN = [3, 5, 7, 10, 12, 15, 18, 20, 25, 30];

// ---------- 유틸 ----------

// 동시 실행 수를 제한한 map. TourAPI 쿼터를 한꺼번에 태우지 않으면서
// 순차 실행보다는 빠르게 상세를 받는다.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

// 정렬된 배열의 백분위값. 보간 없이 가장 가까운 인덱스를 쓴다.
function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.round((p / 100) * (sortedValues.length - 1)))
  );
  return sortedValues[index];
}

// union-find. STEP 6 에서 "threshold 이하 간선만 남겼을 때 몇 덩어리인가"를 센다.
function countComponents(size, edges) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (x) => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== root) {
      const next = parent[x];
      parent[x] = root;
      x = next;
    }
    return root;
  };
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // 루트별로 멤버를 모은다. 큰 덩어리부터.
  const groups = new Map();
  for (let i = 0; i < size; i += 1) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  const components = [...groups.values()].sort((a, b) => b.length - a.length);

  return {
    componentCount: components.length,
    largestComponentSize: components.length === 0 ? 0 : components[0].length,
    components,
  };
}

// ---------- STEP 4. 운영 후보 판정 ----------

// 대한민국 영토의 대략적 경계.
// 지역 판정이 아니라 **좌표가 물리적으로 말이 되는지**만 본다.
// 실제로 TourAPI 가 청송군 POI 에 (19.69, 117.99) — 남중국해 좌표를 준 사례가 있다.
// (파천 구상 화강암, 2026-08-13 실호출 확인. 주소는 정상, 좌표만 오류)
// 이런 값을 걸러내지 않으면 이동시간 행렬 전체가 오염된다(해당 POI 가 낀 쌍이 4,800분).
const KOREA_BBOX = { minLat: 33.0, maxLat: 38.7, minLon: 124.5, maxLon: 132.0 };

function hasPlausibleCoordinates(poi) {
  const { latitude: lat, longitude: lon } = poi;
  if (lat == null || lon == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return (
    lat >= KOREA_BBOX.minLat &&
    lat <= KOREA_BBOX.maxLat &&
    lon >= KOREA_BBOX.minLon &&
    lon <= KOREA_BBOX.maxLon
  );
}

// 거점으로 쓸 수 있는 데이터인지 판정한다. **점수가 아니라 결함 목록**이다.
//   unavailable  — 좌표가 없어 이동시간 계산 자체가 불가능
//   needs_review — 라우팅은 되지만 운영 판단에 필요한 값이 추측인 것
//   valid        — 좌표·운영시간·체류시간이 모두 데이터에서 나온 것
//
// 대부분 needs_review 로 떨어질 것으로 예상한다. 그것이 현재 공공데이터의
// 실제 품질이며, 숨기지 않고 드러내는 것이 이 단계의 목적이다.
function assessViability(poi) {
  const reasons = [];

  if (poi.latitude == null || poi.longitude == null) {
    return { status: "unavailable", reasons: ["no_coordinates"] };
  }
  if (!hasPlausibleCoordinates(poi)) {
    // 주소는 멀쩡한 경우가 많아 지오코딩으로 되살릴 수 있다. 지금은 제외만 한다.
    return { status: "unavailable", reasons: ["coordinates_out_of_range"] };
  }

  if (!poi.sources.detail_common && !poi.sources.detail_intro) {
    reasons.push("detail_not_fetched");
  }
  if (poi.open_windows == null || poi.open_windows.length === 0) {
    reasons.push(`hours_${poi.sources.hours || "not_parsed"}`);
  }
  if (poi.duration_min == null) {
    reasons.push("duration_missing");
  } else if (poi.sources.duration === "policy" || poi.sources.duration === "default") {
    // 값은 있지만 근거가 우리 정책표다. CP-SAT 시간창이 추측 위에 선다.
    reasons.push(`duration_${poi.sources.duration}`);
  }
  if (poi.preference_category == null) {
    // 탈락 사유가 아니라 "선호 매칭에서 카테고리 보너스를 못 받는다"는 표시다.
    // unmapped(코드는 있으나 매핑 규칙 없음)와 no_code(분류코드 자체가 없음)를 구분한다.
    reasons.push(`category_${poi.mapping_status || "not_resolved"}`);
  }

  return {
    status: reasons.length === 0 ? "valid" : "needs_review",
    reasons,
  };
}

// ---------- shortlist 2차 실측 ----------

/**
 * Pareto shortlist 에 오른 조합의 pair 만 카카오로 양방향 실측하고
 * 지표를 다시 계산한다.
 *
 * 왜 여기서만 하는가: 전 권역 pair 를 실측하면 O(n²) 라 쿼터가 감당되지 않는다
 * (경주 권역1 은 방향쌍 10,712개). shortlist 는 권역당 최대 12조합이라
 * 중복 제거 후 수백 콜이면 끝난다.
 *
 * 왕복 중 **큰 값**을 쓴다. 이동시간을 짧게 잡으면 CP-SAT 이 현실에서
 * 못 지키는 일정을 낸다.
 */
async function verifyShortlistTravel(regionCandidates, matrixPoints, poiById, { enabled }) {
  const summary = {
    enabled,
    kakaoCalls: 0,
    kakaoErrors: 0,
    pairsVerified: 0,
    reordered: [],
    skippedReason: enabled ? null : "verifyShortlist=false",
  };
  if (!enabled) return summary;

  const pointByIndex = new Map(matrixPoints.map((p) => [p.index, p]));

  // 여러 조합이 같은 pair 를 공유하므로 중복 호출을 막는다.
  const needed = new Map();
  const combosOf = (bucket) => bucket.combinations || [];

  for (const region of regionCandidates) {
    for (const bucket of [region.best_4_candidates, region.best_5_candidates]) {
      for (const combo of combosOf(bucket)) {
        const idxs = combo.poi_ids
          .map((id) => poiById.get(id)?.__matrixIndex)
          .filter((i) => i != null);
        for (let a = 0; a < idxs.length; a += 1) {
          for (let b = a + 1; b < idxs.length; b += 1) {
            const key = idxs[a] < idxs[b] ? `${idxs[a]}|${idxs[b]}` : `${idxs[b]}|${idxs[a]}`;
            if (!needed.has(key)) needed.set(key, [idxs[a], idxs[b]]);
          }
        }
      }
    }
  }

  const measured = new Map();
  for (const [key, [i, j]] of needed) {
    const from = pointByIndex.get(i);
    const to = pointByIndex.get(j);
    if (!from || !to) continue;

    try {
      // 양방향. 왕복이 다를 수 있어 각각 부르고 큰 값을 남긴다.
      const forward = await travelTime.getTravelTime(from, to, { useCache: false });
      const backward = await travelTime.getTravelTime(to, from, { useCache: false });
      summary.kakaoCalls += 2;

      const worst = forward.travel_min >= backward.travel_min ? forward : backward;
      measured.set(key, {
        travel_min: worst.travel_min,
        source: worst.source,
        forward_min: forward.travel_min,
        backward_min: backward.travel_min,
        asymmetric: forward.travel_min !== backward.travel_min,
      });
      summary.pairsVerified += 1;
    } catch (err) {
      summary.kakaoErrors += 1;
    }
  }

  if (measured.size === 0) return summary;

  // 실측값으로 pairs 를 만들어 조합 지표를 다시 계산한다.
  const verifiedPairs = [...measured.entries()].map(([key, value]) => {
    const [i, j] = key.split("|").map(Number);
    return { i, j, travel_min: value.travel_min, source: value.source };
  });
  const verifiedIndex = hubSelector.buildPairIndex(verifiedPairs);

  for (const region of regionCandidates) {
    for (const bucket of [region.best_4_candidates, region.best_5_candidates]) {
      const before = combosOf(bucket).map((c) => c.poi_ids.join(","));

      for (const combo of combosOf(bucket)) {
        const idxs = combo.poi_ids
          .map((id) => poiById.get(id)?.__matrixIndex)
          .filter((i) => i != null);
        const poiByIndex = new Map(
          idxs.map((i) => [i, poiById.get(matrixPoints[i]?.content_id)]).filter(([, p]) => p)
        );

        const remeasured = hubSelector.measureCombination(idxs, verifiedIndex, poiByIndex);
        combo.estimated = {
          max_pair_travel_min: combo.max_pair_travel_min,
          mean_pair_travel_min: combo.mean_pair_travel_min,
        };
        combo.max_pair_travel_min = remeasured.max_pair_travel_min;
        combo.mean_pair_travel_min = remeasured.mean_pair_travel_min;
        combo.median_pair_travel_min = remeasured.median_pair_travel_min;
        combo.travel_provider_distribution = remeasured.travel_provider_distribution;
        combo.kakao_route_ratio = remeasured.kakao_route_ratio;
        combo.review_reasons = remeasured.review_reasons;
        combo.needs_review = remeasured.needs_review;
      }

      // 실측 후 이동 효율 순서가 바뀌었는지 본다.
      bucket.combinations = combosOf(bucket).sort(
        (a, b) =>
          b.category_coverage - a.category_coverage ||
          a.max_pair_travel_min - b.max_pair_travel_min ||
          a.mean_pair_travel_min - b.mean_pair_travel_min
      );
      const after = bucket.combinations.map((c) => c.poi_ids.join(","));
      if (before.join("|") !== after.join("|")) {
        summary.reordered.push({
          cluster_id: region.cluster_id,
          candidate_size: bucket.candidate_size,
        });
      }
    }
  }

  return summary;
}

// ---------- 경계 변환 ----------

// 파이프라인 내부(snake_case) → 화면·repository(camelCase).
// inventory §3 결정 A. 나중에 전체를 snake_case 로 통일하면 이 함수만 지우면 된다.
//
// 주의: open_windows(구간 배열) → open_min/close_min(스칼라) 축약 정책은 미결이라
// 여기서 줄이지 않는다. DB 저장을 붙이는 시점에 정한다. (inventory §3)
function toLegacyShape(poi) {
  if (!poi) return poi;
  return {
    contentId: poi.content_id,
    contentTypeId: poi.content_type_id,
    name: poi.title,
    addr: poi.address,
    tel: poi.tel,
    image: poi.image_url,
    description: poi.description,
    lat: poi.latitude,
    lon: poi.longitude,
    durationMin: poi.duration_min,
    preferenceCategory: poi.preference_category,
    mappingStatus: poi.mapping_status,
    classificationSource: poi.classification_source,
    classificationCode: poi.classification_code,
    poiRole: poi.poi_role,
    openWindows: poi.open_windows,
    restDays: poi.rest_days,
    accessibility: poi.accessibility,
    viability: poi.viability,
    sources: poi.sources,
  };
}

// ---------- 파이프라인 ----------

/**
 * @param {object} conditions
 * @param {string} conditions.areaCode        시도 코드 (경북 35)
 * @param {string} conditions.sigunguCode     시군구 코드 (청송 19)
 * @param {number[]} conditions.contentTypeIds
 * @param {number|null} conditions.detailLimit  상세를 받을 POI 수 상한 (쿼터 보호)
 * @param {boolean} conditions.fetchImages      detailImage2 까지 받을지
 * @param {number} conditions.maxMatrixPoints   이동시간 행렬 대상 상한
 * @param {number} conditions.kakaoSampleSize   카카오로 실측할 표본 쌍 수
 */
async function runSelectionPipeline(conditions) {
  const {
    areaCode = "35", // 경상북도
    sigunguCode = "21", // 청송군 (19 는 의성군 — 2026-08-13 areaCode2 로 확인)
    sigunguName = "청송군",
    contentTypeIds = [12, 14, 28, 39],
    detailLimit = 60,
    fetchImages = false,
    maxMatrixPoints = 40,
    kakaoSampleSize = 12,
    // STEP 7 shortlist 의 pair 를 카카오로 양방향 실측할지.
    // 켜면 수백 콜이 추가된다. 끄면 조합 지표가 전부 근사 기반이 된다.
    verifyShortlist = false,
    // 카테고리별 집단 선호(사전 설문). null 이면 mock 이 쓰인다.
    surveyDemand = null,
    // 거점 간 최소 이격(분). 0 은 제약 없음 — 기준 미확정이라 기본값이다.
    minSeparationMin = 0,
  } = conditions || {};

  const steps = [];
  const sourceMode = tourApi.isMockMode() ? "mock" : "live";
  tourApi.resetCallStats();

  // ── STEP 1. 수집 ────────────────────────────────────────────────
  const rawItems = await tourApi.getAreaPois({
    areaCode,
    sigunguCode,
    contentTypeIds,
  });

  const byType = {};
  for (const item of rawItems) {
    const label = CONTENT_TYPE_LABEL[Number(item.contenttypeid)] || item.contenttypeid;
    byType[label] = (byType[label] || 0) + 1;
  }

  steps.push({
    id: "collect",
    title: "1. 관광 데이터 수집 (TourAPI)",
    source: `한국관광공사 국문관광정보 areaBasedList2 · ${sourceMode.toUpperCase()}`,
    request: { operation: "areaBasedList2", areaCode, sigunguCode, contentTypeIds },
    metrics: { rawCount: rawItems.length, byType },
    summary: `${sigunguName} 원본 ${rawItems.length}건 수집 (${Object.entries(byType)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")})`,
  });

  // ── STEP 2. 정규화 + 정제 ───────────────────────────────────────
  // 좌표 없는 POI 를 **버리지 않는다.** detailCommon2 로 좌표가 보정될 수 있고,
  // "수집됐으나 좌표 없음"과 "애초에 없음"은 데이터 품질상 다른 사건이다.
  // 실제 제외는 STEP 4 판정에서 한다.
  const normalized = poiNormalizer.normalizeList(rawItems, { source: "areaBasedList2" });

  const seenContentId = new Set();
  const droppedDuplicate = [];
  const sameNameDifferentId = []; // 이름 중복 제거는 하지 않는다 — 관측만
  const seenTitle = new Map();
  const cleaned = [];

  for (const poi of normalized) {
    if (seenContentId.has(poi.content_id)) {
      droppedDuplicate.push({ content_id: poi.content_id, title: poi.title });
      continue;
    }
    seenContentId.add(poi.content_id);

    // 예전 코드는 동명이면 잘라냈다. "대전사"와 "대전사 주차장" 같은 별개 POI 가
    // 사라질 수 있어 제거하지 않고, 실제로 몇 건인지만 센다.
    if (poi.title && seenTitle.has(poi.title)) {
      sameNameDifferentId.push({
        title: poi.title,
        content_ids: [seenTitle.get(poi.title), poi.content_id],
      });
    } else if (poi.title) {
      seenTitle.set(poi.title, poi.content_id);
    }

    cleaned.push(poi);
  }

  const missingCoord = cleaned.filter((p) => p.latitude == null || p.longitude == null);

  steps.push({
    id: "clean",
    title: "2. 정규화 · 중복 제거",
    source: "poiNormalizer.normalizeList · content_id 중복 제거",
    metrics: {
      before: normalized.length,
      after: cleaned.length,
      droppedDuplicate: droppedDuplicate.length,
      // 화면 계약상 남겨두는 키. 이 단계에서 좌표 누락을 제외하지 않으므로 항상 0.
      droppedNoCoord: 0,
      missingCoordKept: missingCoord.length,
      sameNameDifferentId: sameNameDifferentId.length,
    },
    summary:
      `content_id 중복 ${droppedDuplicate.length}건 제거 → ${cleaned.length}건 유지. ` +
      `좌표 누락 ${missingCoord.length}건은 상세 보정을 위해 남겨둠`,
    detail: {
      droppedDuplicate,
      sameNameDifferentId,
      missingCoord: missingCoord.map((p) => ({
        content_id: p.content_id,
        title: p.title,
      })),
    },
  });

  // ── STEP 3. 상세 보강 ───────────────────────────────────────────
  // POI 당 detailCommon2 + detailIntro2 = 2콜(이미지 포함 시 3콜).
  // 개발계정 쿼터(일 1,000회로 알려짐, 미검증)를 넘기지 않도록 상한을 둔다.
  // 상한에 걸려 잘린 POI 는 "품질이 낮아서"가 아니라 "예산이 없어서" 빠진 것이므로
  // trace 에 그대로 남긴다.
  const detailTargets = detailLimit == null ? cleaned : cleaned.slice(0, detailLimit);
  const detailSkipped = detailLimit == null ? [] : cleaned.slice(detailLimit);

  const detailErrors = [];
  await mapWithConcurrency(detailTargets, 4, async (poi) => {
    try {
      const common = await tourApi.getDetailCommon(poi.content_id);
      if (common) poiNormalizer.mergeDetailCommon(poi, common);
    } catch (err) {
      detailErrors.push({ content_id: poi.content_id, op: "detailCommon2", message: err.message });
    }

    try {
      const intro = await tourApi.getDetailIntro(poi.content_id, poi.content_type_id);
      if (intro) poiNormalizer.mergeDetailIntro(poi, intro);
    } catch (err) {
      detailErrors.push({ content_id: poi.content_id, op: "detailIntro2", message: err.message });
    }

    if (fetchImages) {
      try {
        const images = await tourApi.getDetailImages(poi.content_id);
        if (images.length > 0) poiNormalizer.mergeDetailImages(poi, images);
      } catch (err) {
        detailErrors.push({ content_id: poi.content_id, op: "detailImage2", message: err.message });
      }
    }

    // 원문이 채워진 뒤에야 해석할 수 있다. 순서를 바꾸면 안 된다.
    applyOperatingHours(poi);
    applyDuration(poi);
    // 매핑표가 비어 있는 동안에는 keywords 를 null 로 두고 분류명만 붙인다.
    // (docs/keyword-mapping-facts.md §B — 어휘 결정 대기)
    keywordMapper.applyKeywords(poi);

    // withTourApiClient(무장애) — 활용신청 승인 대기.
    return poi;
  });

  // 상세를 못 받은 POI 도 체류시간은 정책값으로라도 채워 둔다(근거는 source 에 남는다).
  // 키워드도 마찬가지 — 신 분류는 상세에만 오므로 여기선 구 분류만 잡힌다.
  for (const poi of detailSkipped) {
    applyDuration(poi);
    keywordMapper.applyKeywords(poi);
  }

  const hoursSourceCount = {};
  const durationSourceCount = {};
  const categoryCount = {};
  const mappingStatusCount = {};
  const roleCount = {};
  for (const poi of cleaned) {
    const h = poi.sources.hours || "not_fetched";
    const d = poi.sources.duration || "not_resolved";
    hoursSourceCount[h] = (hoursSourceCount[h] || 0) + 1;
    durationSourceCount[d] = (durationSourceCount[d] || 0) + 1;

    const c = poi.preference_category || "(미매핑)";
    categoryCount[c] = (categoryCount[c] || 0) + 1;
    mappingStatusCount[poi.mapping_status] = (mappingStatusCount[poi.mapping_status] || 0) + 1;
    roleCount[poi.poi_role] = (roleCount[poi.poi_role] || 0) + 1;
  }
  const coordRecovered = missingCoord.filter((p) => p.latitude != null).length;

  // 매핑표를 보강할 때 그대로 작업 목록이 되는 것.
  const unmappedCodes = keywordMapper.collectUnmappedCodes(cleaned);

  steps.push({
    id: "enrich",
    title: "3. 상세정보 보강",
    source: "detailCommon2 + detailIntro2 → operatingHoursParser · durationResolver",
    metrics: {
      enriched: detailTargets.length,
      skippedByLimit: detailSkipped.length,
      detailErrors: detailErrors.length,
      coordRecovered,
      hoursSource: hoursSourceCount,
      durationSource: durationSourceCount,
      preferenceCategory: categoryCount,
      mappingStatus: mappingStatusCount,
      poiRole: roleCount,
      unmappedCodeCount: unmappedCodes.length,
      apiCalls: tourApi.getCallStats(),
    },
    summary:
      `${detailTargets.length}건 상세 보강 (상한 ${detailLimit ?? "없음"}), ` +
      `좌표 ${coordRecovered}건 보정. ` +
      `체류시간 출처: ${Object.entries(durationSourceCount)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    detail: {
      // 이 두 값이 '정책값'에 몰려 있으면 CP-SAT 시간창이 추측 위에 서 있다는 뜻이다.
      note: "duration_min 의 policy/default 비중과 open_windows 의 unknown 비중이 데이터 품질 지표",
      skippedByLimit: detailSkipped.map((p) => ({ content_id: p.content_id, title: p.title })),
      detailErrors,
      // 매핑 실패는 탈락이 아니다. 거점 후보로는 남되 선호 매칭에서
      // 카테고리 보너스를 받지 않는다. (docs/keyword-mapping-facts.md §B-4)
      keywordMapper: `미매핑 분류코드 ${unmappedCodes.length}종`,
      unmappedCodes,
      accessibilityApi: "미구현 — 무장애 여행정보 활용신청 대기",
    },
  });

  // ── STEP 4. 운영 후보 판정 ──────────────────────────────────────
  const statusCount = { valid: 0, needs_review: 0, unavailable: 0 };
  const reasonCount = {};

  for (const poi of cleaned) {
    poi.viability = assessViability(poi);
    statusCount[poi.viability.status] += 1;
    for (const reason of poi.viability.reasons) {
      reasonCount[reason] = (reasonCount[reason] || 0) + 1;
    }
  }

  const routable = cleaned.filter((p) => p.viability.status !== "unavailable");

  steps.push({
    id: "viability",
    title: "4. 운영 후보 판정",
    source: "좌표 · 운영시간 · 체류시간 근거 확인 (점수 아님)",
    metrics: { ...statusCount, routable: routable.length, reasonCount },
    summary:
      `valid ${statusCount.valid} / needs_review ${statusCount.needs_review} / ` +
      `unavailable ${statusCount.unavailable} — 이동시간 계산 대상 ${routable.length}건`,
    detail: {
      note: "needs_review 는 탈락이 아니라 '값의 근거가 약함' 표시다. 거점 선정 기준이 정해지면 어떻게 다룰지 결정한다.",
      unavailable: cleaned
        .filter((p) => p.viability.status === "unavailable")
        .map((p) => ({ content_id: p.content_id, title: p.title, reasons: p.viability.reasons })),
    },
  });

  // ── STEP 5. 이동시간 행렬 ───────────────────────────────────────
  // 왜 전부 카카오로 부르지 않는가:
  //   행렬은 O(n²) 이다. 유효 POI 40개면 방향쌍 1,560개.
  //   지금 필요한 것은 개별 구간의 정확한 값이 아니라 **분포**이므로,
  //   전체는 무료인 하버사인 근사로 채우고, 카카오는 표본만 불러
  //   근사의 오차(ROAD_DETOUR_FACTOR = 1.5, 표본 1건 근거)를 실측한다.
  const matrixPoints = routable.slice(0, maxMatrixPoints).map((poi, index) => {
    // STEP 7 이 POI 에서 바로 행렬 자리를 찾을 수 있게 역참조를 붙인다.
    // 행렬에 못 들어간 POI 는 이 값이 없어 조합 후보에서 자동 제외된다.
    poi.__matrixIndex = index;
    return {
      index,
      content_id: poi.content_id,
      name: poi.title,
      lat: poi.latitude,
      lon: poi.longitude,
    };
  });

  const pairs = [];
  for (let i = 0; i < matrixPoints.length; i += 1) {
    for (let j = i + 1; j < matrixPoints.length; j += 1) {
      const estimate = travelTime.estimateByDistance(matrixPoints[i], matrixPoints[j]);
      pairs.push({
        i,
        j,
        travel_min: estimate.travel_min,
        distance_m: estimate.distance_m,
        source: estimate.source,
      });
    }
  }

  // 카카오 표본: 거리 분포 전 구간에 고르게 흩어지도록 등간격으로 고른다.
  // 가까운 쌍만 부르면 오차 측정이 한쪽으로 치우친다.
  const sampleTargets = [];
  if (kakaoSampleSize > 0 && pairs.length > 0) {
    const byDistance = [...pairs].sort((a, b) => a.distance_m - b.distance_m);
    const stride = Math.max(1, Math.floor(byDistance.length / kakaoSampleSize));
    for (let k = 0; k < byDistance.length && sampleTargets.length < kakaoSampleSize; k += stride) {
      sampleTargets.push(byDistance[k]);
    }
  }

  const calibration = [];
  const kakaoErrors = [];
  for (const pair of sampleTargets) {
    // 덮어쓰기 전에 근사값을 붙잡아 둔다. 이 둘의 차이가 곧 근사의 오차다.
    const estimatedMin = pair.travel_min;
    const estimatedDistanceM = pair.distance_m;

    try {
      const measured = await travelTime.getTravelTime(
        matrixPoints[pair.i],
        matrixPoints[pair.j],
        { useCache: false }
      );
      // 카카오 값으로 해당 쌍을 덮어쓴다. 표본은 근사보다 신뢰도가 높다.
      pair.travel_min = measured.travel_min;
      pair.distance_m = measured.distance_m ?? estimatedDistanceM;
      pair.source = measured.source;

      calibration.push({
        from: matrixPoints[pair.i].name,
        to: matrixPoints[pair.j].name,
        estimated_min: estimatedMin,
        measured_min: measured.travel_min,
        // >1 이면 근사가 실제보다 짧게 잡았다는 뜻(위험한 방향).
        ratio: estimatedMin ? Number((measured.travel_min / estimatedMin).toFixed(2)) : null,
        estimated_distance_m: estimatedDistanceM,
        measured_distance_m: measured.distance_m,
        source: measured.source,
      });
    } catch (err) {
      kakaoErrors.push({ i: pair.i, j: pair.j, message: err.message });
    }
  }

  // ROAD_DETOUR_FACTOR(현재 1.5, 표본 1건 근거)를 검증할 수 있는 유일한 수치.
  const measuredRatios = calibration.map((c) => c.ratio).filter((r) => r != null);
  const detourCheck = measuredRatios.length
    ? {
        samples: measuredRatios.length,
        medianRatio: percentile([...measuredRatios].sort((a, b) => a - b), 50),
        minRatio: Math.min(...measuredRatios),
        maxRatio: Math.max(...measuredRatios),
      }
    : null;

  const bySource = {};
  for (const pair of pairs) bySource[pair.source] = (bySource[pair.source] || 0) + 1;

  steps.push({
    id: "travel",
    title: "5. 이동시간 행렬 생성",
    source: `하버사인×${travelTime.FALLBACK_KMH}km/h 전체 + 카카오 표본 실측`,
    metrics: {
      points: matrixPoints.length,
      excludedByLimit: Math.max(0, routable.length - matrixPoints.length),
      pairCount: pairs.length,
      kakaoCalls: sampleTargets.length,
      kakaoErrors: kakaoErrors.length,
      bySource,
      detourCheck,
    },
    summary:
      `${matrixPoints.length}개 지점 · 무방향 ${pairs.length}쌍 계산 ` +
      `(카카오 실측 ${calibration.length}쌍, 나머지는 근사)`,
    detail: {
      note: "전체를 카카오로 부르면 O(n²) 라 쿼터가 감당되지 않는다. 분포 관측이 목적이므로 근사 + 표본 실측으로 대체했다.",
      detourNote:
        `ratio = 실측/근사. 1보다 크면 근사가 실제보다 짧게 잡은 것으로, ` +
        `TRAVEL_DETOUR_FACTOR(현재 ${travelTime.FALLBACK_KMH}km/h 기준 1.5)를 올려야 한다는 신호다.`,
      calibration,
      kakaoErrors,
    },
  });

  // ── STEP 6. 권역 구성 ───────────────────────────────────────────
  // 기준은 REGION_THRESHOLD_MIN(15분). 청송 실측 분포에서 고른 값이다.
  // 관측표(byThreshold)는 계속 낸다 — 다른 시군구에서 15분이 안 맞을 수 있고,
  // 그때 기준을 바꿀 근거가 이 표다.
  const minutes = pairs.map((p) => p.travel_min).sort((a, b) => a - b);

  const byThreshold = {};
  for (const threshold of PROBE_THRESHOLDS_MIN) {
    const edges = pairs.filter((p) => p.travel_min <= threshold);

    // 각 POI 가 threshold 안에 이웃을 몇 개 갖는지 → 4~5개 거점 묶음이 성립하는지
    const degree = new Array(matrixPoints.length).fill(0);
    for (const edge of edges) {
      degree[edge.i] += 1;
      degree[edge.j] += 1;
    }

    const { componentCount, largestComponentSize } = countComponents(
      matrixPoints.length,
      edges.map((e) => [e.i, e.j])
    );

    byThreshold[threshold] = {
      edgeCount: edges.length,
      edgeRatio: pairs.length ? Number((edges.length / pairs.length).toFixed(3)) : 0,
      componentCount,
      largestComponentSize,
      // 자기 자신 포함 4개(=이웃 3개 이상)가 되는 POI 수.
      // 이 값이 0 이면 해당 기준으로는 거점 4곳을 묶을 수 없다는 뜻이다.
      poisWith3PlusNeighbors: degree.filter((d) => d >= 3).length,
      poisWith4PlusNeighbors: degree.filter((d) => d >= 4).length,
      isolatedPois: degree.filter((d) => d === 0).length,
    };
  }

  // 확정 기준(15분)으로 실제 권역을 구성한다. STEP 7 이 이 위에서 거점을 고른다.
  const regionEdges = pairs.filter((p) => p.travel_min <= REGION_THRESHOLD_MIN);
  const { components } = countComponents(
    matrixPoints.length,
    regionEdges.map((e) => [e.i, e.j])
  );

  const regions = components.map((memberIndexes, rank) => {
    const members = memberIndexes.map((i) => matrixPoints[i]);
    // 권역 내부 이동시간. 거점 4~5개를 이 안에서 고르므로 내부 응집도가 중요하다.
    const inner = regionEdges.filter(
      (e) => memberIndexes.includes(e.i) && memberIndexes.includes(e.j)
    );
    const innerMinutes = inner.map((e) => e.travel_min).sort((a, b) => a - b);

    return {
      rank: rank + 1,
      size: members.length,
      // 거점 4~5개를 뽑으려면 최소 4개가 필요하다.
      canHostBases: members.length >= 4,
      innerMedianMin: percentile(innerMinutes, 50),
      innerMaxMin: innerMinutes.length ? innerMinutes[innerMinutes.length - 1] : null,
      members: members.map((m) => ({ content_id: m.content_id, name: m.name })),
    };
  });

  const hostableRegions = regions.filter((r) => r.canHostBases);

  steps.push({
    id: "cluster",
    title: `6. 권역 구성 (기준 ${REGION_THRESHOLD_MIN}분)`,
    source: `이동시간 ${REGION_THRESHOLD_MIN}분 이내를 같은 권역으로 판정 — 청송 실측 분포 기반`,
    metrics: {
      thresholdMin: REGION_THRESHOLD_MIN,
      regionCount: regions.length,
      hostableRegionCount: hostableRegions.length,
      largestRegionSize: regions.length ? regions[0].size : 0,
      pairCount: pairs.length,
      minMin: minutes.length ? minutes[0] : null,
      p25Min: percentile(minutes, 25),
      medianMin: percentile(minutes, 50),
      p75Min: percentile(minutes, 75),
      maxMin: minutes.length ? minutes[minutes.length - 1] : null,
      byThreshold,
      // 화면 계약상 남겨두는 키. 반경 방식을 폐기했으므로 의미 없는 값이다.
      radiusKm: null,
      inRadius: null,
    },
    summary: minutes.length
      ? `${REGION_THRESHOLD_MIN}분 기준 ${regions.length}개 권역 ` +
        `(4곳 이상 수용 가능 ${hostableRegions.length}개, 최대 ${regions[0].size}개). ` +
        `전체 이동시간 중앙값 ${percentile(minutes, 50)}분`
      : "이동시간 쌍이 없어 권역을 구성할 수 없음",
    detail: {
      thresholdRationale:
        `20분이면 지역 전체가 한 덩어리가 되어 구분력이 없고, 3분이면 잘게 부서진다. ` +
        `15분은 거점 4~5개 묶기가 성립하면서 지역이 갈리는 지점이다. ` +
        `(docs/poi-selection-observations.md §3)`,
      regions,
      byThresholdNote:
        "다른 시군구에서 15분이 안 맞을 수 있다. byThreshold 표를 보고 기준을 조정한다 " +
        "(POI_REGION_THRESHOLD_MIN 환경변수).",
    },
  });

  // ── STEP 7. 권역별 GUIDE_HUB 후보 ───────────────────────────────
  // 하나로 좁히지 않는다. 권역마다 4개·5개 후보를 **따로** 낸다.
  //   - 4개와 5개는 카테고리 coverage 최대치부터 달라 같은 랭킹에서 비교하면 안 된다
  //   - 최종 개수·권역 선택은 가이드 수·운영비·현장 협약·사전 설문으로 정할 일이다
  const poiById = new Map(cleaned.map((p) => [p.content_id, p]));

  // 카테고리별 집단 선호. 옛 40/36/20/6 배점을 대체한다.
  // **설문 미실시 상태에서는 mock 이며 결과에 source 를 실어 보낸다.**
  const survey = surveyPreference.loadSurvey(surveyDemand ? { demand: surveyDemand } : {});
  const selectorOptions = { demand: survey.demand, minSeparation: minSeparationMin };

  const regionCandidates = regions.map((region) => {
    const regionPois = region.members
      .map((m) => poiById.get(m.content_id))
      .filter(Boolean);

    return {
      cluster_id: region.rank,
      cluster_size: region.size,
      best_4_candidates: hubSelector.selectHubCandidates(regionPois, pairs, 4, selectorOptions),
      best_5_candidates: hubSelector.selectHubCandidates(regionPois, pairs, 5, selectorOptions),
      // 이격 기준을 정하기 위한 관측. 판정하지 않는다.
      separation_probe: {
        k4: hubSelector.probeSeparations(regionPois, pairs, 4, PROBE_SEPARATIONS_MIN, {
          demand: survey.demand,
        }),
        k5: hubSelector.probeSeparations(regionPois, pairs, 5, PROBE_SEPARATIONS_MIN, {
          demand: survey.demand,
        }),
      },
    };
  });

  // ── shortlist 2차 실측 ──────────────────────────────────────────
  // 1차는 전 권역을 무료 근사로 돌렸다. 그 상태로는 어떤 조합을 봐도
  // provider 가 전부 fallback 이라 kakao_route_ratio 가 변별력이 없다.
  // shortlist 가 확정된 지금, **그 조합의 pair 만** 카카오로 양방향 실측한다.
  //
  // 근사가 최악 1.69배 짧게 잡는 것이 확인됐으므로(observations §6)
  // 실측 후 순위가 바뀔 수 있다. 바뀌면 그 사실을 남긴다.
  const verification = await verifyShortlistTravel(
    regionCandidates,
    matrixPoints,
    poiById,
    { enabled: verifyShortlist }
  );

  // 하나로 확정하지 않는다. 최종 선택은 운영 정책의 몫이다.
  const selected = [];

  const comboCount = (key) =>
    regionCandidates.reduce((sum, r) => sum + (r[key].combinations?.length || 0), 0);
  const withCandidates = regionCandidates.filter(
    (r) => r.best_4_candidates.combinations.length > 0 ||
      r.best_5_candidates.combinations.length > 0
  );
  const needsReviewCount = regionCandidates.reduce(
    (sum, r) =>
      sum +
      [...r.best_4_candidates.combinations, ...r.best_5_candidates.combinations].filter(
        (c) => c.needs_review
      ).length,
    0
  );

  steps.push({
    id: "select",
    title: "7. 권역별 GUIDE_HUB 후보",
    source: "Pareto (커버리지↑ / 이동시간↓) — 가중치·배점 없음",
    metrics: {
      // 화면 계약상 남기는 키. 하나로 확정하지 않으므로 항상 0 이다.
      selected: 0,
      targetMin: 4,
      targetMax: 5,
      hostableRegions: hostableRegions.length,
      regionsWithCandidates: withCandidates.length,
      combos4: comboCount("best_4_candidates"),
      combos5: comboCount("best_5_candidates"),
      needsReviewCombos: needsReviewCount,
      shortlistVerification: verification,
      // 이 실행의 카테고리 가중이 실제 수요인지 가짜인지.
      surveySource: survey.source,
      minSeparationMin,
    },
    summary:
      `권역 ${withCandidates.length}개에서 4개 조합 ${comboCount("best_4_candidates")}건 · ` +
      `5개 조합 ${comboCount("best_5_candidates")}건 도출 ` +
      `(검수 필요 ${needsReviewCount}건)` +
      (survey.source === surveyPreference.SURVEY_SOURCE_MOCK
        ? " ⚠ 설문 mock"
        : ""),
    detail: {
      method:
        "카테고리가 5종뿐이라 부분집합이 최대 32개다. 각 집합마다 '그 집합을 " +
        "전부 덮는 최소 diameter' 를 구해 2축 Pareto front 를 얻는다 " +
        "(maximize demand_covered / minimize diameter). " +
        "전수 열거와 결과가 같은 정확 해법이며 임의 배점이 없다.",
      survey: {
        source: survey.source,
        respondents: survey.respondents,
        demand: survey.demand,
        note: survey.note,
        uncoveredCategories: surveyPreference.findUncoveredCategories(survey.demand),
      },
      separationNote:
        "minSeparationMin 기본값은 0(제약 없음)이다. 이격이 없으면 거점 4곳이 같은 " +
        "관광단지 안으로 수렴한다. separation_probe 를 보고 기준을 정해야 한다.",
      regionCandidates,
      notDecidedHere: [
        "최종 4개냐 5개냐 — 가이드 수·운영비·현장 협약 상태",
        "어느 권역을 운영할지 — 사전 설문·지자체 시범 지역",
        "카테고리별 가중치 — 설문 데이터 확보 후",
      ],
      note:
        "데이터 품질은 선정 점수에 넣지 않는다. needs_review 판단에만 쓴다. " +
        "duration 은 대부분 policy 라 선정 기준에서 제외했다.",
    },
  });

  return {
    region: { areaCode, sigunguCode, sigunguName },
    // 이 결과가 실측인지 mock 인지, 그리고 왜 그렇게 결정됐는지.
    // 문서·DB 로 흘러갈 때 반드시 함께 따라가야 하는 값이다.
    sourceModeReason: tourApi.getSourceMode().reason,
    regionThresholdMin: REGION_THRESHOLD_MIN,
    regions,
    // STEP 7 결과. 권역별 4개·5개를 따로 담는다.
    regionCandidates,
    conditions: {
      contentTypeIds,
      detailLimit,
      fetchImages,
      maxMatrixPoints,
      kakaoSampleSize,
    },
    sourceMode,
    steps,
    apiCalls: tourApi.getCallStats(),
    candidates: cleaned,
    selected,
    travel: { points: matrixPoints, pairs },
  };
}

module.exports = {
  runSelectionPipeline,
  assessViability,
  hasPlausibleCoordinates,
  KOREA_BBOX,
  toLegacyShape,
  percentile,
  countComponents,
  CONTENT_TYPE_LABEL,
  PROBE_THRESHOLDS_MIN,
  REGION_THRESHOLD_MIN,
};
