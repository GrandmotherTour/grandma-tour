// 가이드 포인트 선정 파이프라인
//
// 청송군(또는 임의 시군구) POI 를 수집 → 정제 → 보강 → 거리·군집 판정 →
// 점수화 → 최종 선정한다. 각 단계는 trace(steps)로 기록되어
// 관리자 화면에서 "어떤 데이터를 가져오는지 / 어떻게 판단하는지"를 보여준다.

const tourApi = require("./tourApiClient");
const kakao = require("./kakaoClient");
const dataLab = require("./dataLabClient");
const {
  POI_KEYWORDS,
  REGION_CENTERS,
  GYEONGBUK_SIGUNGU,
} = require("./mockData");

// ---------- 유틸 ----------

// 두 좌표 간 거리(km) — 하버사인
function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// contentTypeId → 기본 체류시간(분)
const DEFAULT_DURATION = {
  12: 90, // 관광지
  14: 60, // 문화시설
  15: 60, // 축제/행사
  25: 90, // 여행코스
  28: 60, // 레포츠
  38: 40, // 쇼핑
  39: 40, // 음식점
};

const CONTENT_TYPE_LABEL = {
  12: "관광지",
  14: "문화시설",
  15: "축제/행사",
  25: "여행코스",
  28: "레포츠",
  38: "쇼핑",
  39: "음식점",
};

// 이름/타입 기반 키워드 유추 (POI_KEYWORDS 에 없을 때 live 용)
function deriveKeywords(name, contentTypeId) {
  const kws = new Set();
  const type = Number(contentTypeId);

  if (type === 12) kws.add("자연산책");
  if (type === 14) kws.add("실내");
  if (type === 28) kws.add("체험");
  if (type === 39) kws.add("음식");

  const n = name || "";
  if (/(산|계곡|약수|폭포|호수|공원|주산지|숲|휴양림)/.test(n)) kws.add("자연산책");
  if (/(고택|서원|향교|문학|박물관|미술관|유적|사(寺|찰)|절|대전사)/.test(n)) {
    kws.add("역사");
    kws.add("실내");
  }
  if (/(백자|공방|체험|테마파크|도자)/.test(n)) kws.add("체험");
  if (/(사과|먹거리|맛집|약수|식당)/.test(n)) kws.add("음식");
  if (/(주산지|호수|풍경|명소|전망)/.test(n)) kws.add("사진명소");
  if (kws.size === 0) kws.add("자연산책");
  return [...kws];
}

function keywordsForPoi(poi) {
  if (POI_KEYWORDS[poi.contentId]) return POI_KEYWORDS[poi.contentId];
  return deriveKeywords(poi.name, poi.contentTypeId);
}

// 선정된 포인트에 배정할 거점 상주 가이드 풀
const GUIDE_POOL = [
  "김영자", "박순희", "이정숙", "최말자", "정옥분",
  "한미자", "오복순", "장금순", "윤복례", "서말임",
];

// ---------- 파이프라인 ----------

async function runSelectionPipeline(conditions) {
  const {
    areaCode = "35",
    sigunguCode = "19",
    sigunguName = "청송군",
    contentTypeIds = [12, 14, 28, 39],
    radiusKm = 2.5,
    minPoints = 2,
    maxPoints = 3,
    preferredKeywords = ["자연산책", "역사", "사진명소", "음식", "체험"],
    center: centerOverride = null,
    tourBudgetMin = 120,
  } = conditions || {};

  const steps = [];
  const sourceMode = tourApi.isMockMode() ? "mock" : "live";

  // ── STEP 1. 수집 (TourAPI areaBasedList2) ──────────────────────────
  const rawItems = await tourApi.fetchAreaBasedList({
    areaCode,
    sigunguCode,
    contentTypeIds,
  });
  const typeLabels = contentTypeIds
    .map((t) => CONTENT_TYPE_LABEL[t] || t)
    .join(", ");
  steps.push({
    id: "collect",
    title: "1. 관광 데이터 수집 (TourAPI)",
    source: `한국관광공사 국문관광정보 areaBasedList2 · ${sourceMode.toUpperCase()}`,
    request: {
      operation: "areaBasedList2",
      areaCode,
      sigunguCode,
      contentTypeIds,
    },
    metrics: { rawCount: rawItems.length },
    summary: `${typeLabels} 카테고리에서 원본 ${rawItems.length}건 수집`,
    sample: rawItems.slice(0, 5).map((it) => ({
      name: it.title,
      type: CONTENT_TYPE_LABEL[Number(it.contenttypeid)] || it.contenttypeid,
      hasCoord: Boolean(it.mapx && it.mapy),
    })),
  });

  // ── STEP 2. 정제 (좌표 없음 제거 + 중복 제거) ──────────────────────
  const normalized = rawItems.map((it) => ({
    contentId: String(it.contentid),
    contentTypeId: Number(it.contenttypeid),
    name: (it.title || "").trim(),
    addr: it.addr1 || "",
    lat: it.mapy ? Number(it.mapy) : null,
    lon: it.mapx ? Number(it.mapx) : null,
    tel: it.tel || "",
    image: it.firstimage || "",
  }));

  const droppedNoCoord = [];
  const droppedDup = [];
  const seenContentId = new Set();
  const seenName = new Set();
  const cleaned = [];

  for (const poi of normalized) {
    if (poi.lat == null || poi.lon == null || Number.isNaN(poi.lat)) {
      droppedNoCoord.push(poi.name);
      continue;
    }
    if (seenContentId.has(poi.contentId) || seenName.has(poi.name)) {
      droppedDup.push(poi.name);
      continue;
    }
    seenContentId.add(poi.contentId);
    seenName.add(poi.name);
    cleaned.push(poi);
  }

  steps.push({
    id: "clean",
    title: "2. 데이터 정제",
    source: "좌표 누락 제거 · 중복 제거",
    metrics: {
      before: normalized.length,
      after: cleaned.length,
      droppedNoCoord: droppedNoCoord.length,
      droppedDuplicate: droppedDup.length,
    },
    summary: `좌표 없음 ${droppedNoCoord.length}건, 중복 ${droppedDup.length}건 제거 → ${cleaned.length}건 유지`,
    detail: { droppedNoCoord, droppedDuplicate: droppedDup },
  });

  // ── STEP 3. 중심좌표 확정 (카카오 지오코딩 → 폴백) ────────────────
  let center = centerOverride;
  let centerMethod = "conditions.center";
  if (!center) {
    const geo = await kakao.geocodeRegion(`경상북도 ${sigunguName}`);
    if (geo) {
      center = geo;
      centerMethod = "kakao-geocode";
    } else if (REGION_CENTERS[sigunguName]) {
      center = REGION_CENTERS[sigunguName];
      centerMethod = "fallback-preset";
    } else {
      // 최후: 정제된 POI 들의 중심(centroid)
      const avgLat =
        cleaned.reduce((s, p) => s + p.lat, 0) / (cleaned.length || 1);
      const avgLon =
        cleaned.reduce((s, p) => s + p.lon, 0) / (cleaned.length || 1);
      center = { lat: avgLat, lon: avgLon };
      centerMethod = "centroid";
    }
  }
  steps.push({
    id: "center",
    title: "3. 중심 좌표 확정",
    source: kakao.hasKakaoKey() ? "카카오맵 로컬 API" : "폴백(프리셋/센트로이드)",
    metrics: { lat: Number(center.lat.toFixed(5)), lon: Number(center.lon.toFixed(5)) },
    summary: `중심 좌표 (${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}) — 방식: ${centerMethod}`,
  });

  // ── STEP 4. 보강 (데이터랩 인기도) ────────────────────────────────
  const popMap = await dataLab.getPopularityMap(
    cleaned.map((p) => p.name),
    { regionName: sigunguName }
  );
  for (const poi of cleaned) {
    const hit = popMap[poi.name] || { popularity: 50, source: "fallback" };
    poi.popularity = hit.popularity;
    poi.popularitySource = hit.source;
    poi.keywords = keywordsForPoi(poi);
    poi.durationMin = DEFAULT_DURATION[poi.contentTypeId] || 60;
  }
  steps.push({
    id: "enrich",
    title: "4. 인기도·키워드 보강",
    source: dataLab.hasDataLabKey()
      ? "한국관광 데이터랩 방문자 통계"
      : "데이터랩(mock) 인기도",
    metrics: {
      enriched: cleaned.length,
      avgPopularity: Math.round(
        cleaned.reduce((s, p) => s + p.popularity, 0) / (cleaned.length || 1)
      ),
    },
    summary: `${cleaned.length}개 POI 에 방문자 인기도(0~100) 및 키워드 부여`,
    sample: cleaned
      .slice(0, 5)
      .map((p) => ({ name: p.name, popularity: p.popularity, keywords: p.keywords })),
  });

  // ── STEP 5. 거리·군집 판정 (반경 radiusKm) ────────────────────────
  for (const poi of cleaned) {
    poi.distanceKm = Number(
      haversineKm(center.lat, center.lon, poi.lat, poi.lon).toFixed(2)
    );
  }
  const inRadius = cleaned.filter((p) => p.distanceKm <= radiusKm);
  const outRadius = cleaned.filter((p) => p.distanceKm > radiusKm);

  // 반경 안 후보가 너무 적으면 가까운 순으로 보충한다.
  // 이때 반경 밖 POI 가 후보로 되살아나므로, 어떤 POI 가 다시 들어왔는지
  // trace 에 남겨야 화면의 "제외" 목록과 실제 선정 결과가 어긋나지 않는다.
  let candidates = inRadius;
  let widened = null;
  if (candidates.length < minPoints) {
    candidates = [...cleaned].sort((a, b) => a.distanceKm - b.distanceKm);
    widened = candidates.filter((p) => p.distanceKm > radiusKm);
  }

  steps.push({
    id: "cluster",
    title: "5. 거리·군집 판정",
    source: `중심 반경 ${radiusKm}km 이내 필터 (제안서 '2.5km/120분' 콘셉트)`,
    metrics: {
      inRadius: inRadius.length,
      outRadius: outRadius.length,
      radiusKm,
      candidates: candidates.length,
      widened: Boolean(widened),
    },
    summary: widened
      ? `반경 ${radiusKm}km 이내 ${inRadius.length}개로 최소 ${minPoints}개에 미달 — 반경을 풀어 가까운 순 ${candidates.length}개를 후보로 사용`
      : `반경 ${radiusKm}km 이내 ${inRadius.length}개 포함 / ${outRadius.length}개 제외`,
    detail: {
      excluded: widened
        ? []
        : outRadius
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((p) => ({ name: p.name, distanceKm: p.distanceKm })),
      // 반경 밖이지만 후보로 되살아난 POI
      readmitted: widened
        ? widened.map((p) => ({ name: p.name, distanceKm: p.distanceKm }))
        : [],
    },
  });

  // ── STEP 6. 점수화 ────────────────────────────────────────────────
  const prefSet = new Set(preferredKeywords);

  // 근접도 정규화 기준. 반경만 쓰면 반경 밖 후보가 모두 0점이 되어
  // 거리가 순위에 전혀 반영되지 않으므로, 실제 후보 최대 거리도 함께 본다.
  const maxCandidateKm = candidates.reduce((m, p) => Math.max(m, p.distanceKm), 0);
  const proximityBase = Math.max(radiusKm || 1, maxCandidateKm);

  for (const poi of candidates) {
    const matched = poi.keywords.filter((k) => prefSet.has(k));
    const popScore = 0.4 * poi.popularity; // 0~40
    const fitScore = Math.min(matched.length, 3) * 12; // 0~36
    const proximityScore =
      Math.max(0, 20 * (1 - poi.distanceKm / proximityBase)); // 0~20
    const imageScore = poi.image ? 6 : 0; // 0~6
    poi.matchedKeywords = matched;
    poi.scoreBreakdown = {
      popularity: Number(popScore.toFixed(1)),
      keywordFit: fitScore,
      proximity: Number(proximityScore.toFixed(1)),
      hasImage: imageScore,
    };
    poi.score = Number(
      (popScore + fitScore + proximityScore + imageScore).toFixed(1)
    );
  }
  const scored = [...candidates].sort((a, b) => b.score - a.score);
  steps.push({
    id: "score",
    title: "6. 점수 산출",
    source: "인기도0.4 + 키워드적합 + 근접도 + 이미지",
    metrics: { scoredCount: scored.length, proximityBaseKm: Number(proximityBase.toFixed(2)) },
    summary: `가중 점수 = 인기도(0~40) + 선호키워드 적합(0~36) + 근접도(0~20) + 이미지(0~6)`,
    sample: scored.slice(0, 6).map((p) => ({
      name: p.name,
      score: p.score,
      breakdown: p.scoreBreakdown,
    })),
  });

  // ── STEP 7. 최종 선정 (점수순 + 카테고리 다양성 + 120분 예산) ─────
  const selected = [];
  const usedCategories = new Set();
  let budgetMin = 0;
  const AVG_TRAVEL_MIN = 15;

  const addPoi = (poi) => {
    const travel = selected.length > 0 ? AVG_TRAVEL_MIN : 0;
    if (budgetMin + travel + poi.durationMin > tourBudgetMin && selected.length >= minPoints) {
      return false;
    }
    budgetMin += travel + poi.durationMin;
    poi.assignedGuide = `${GUIDE_POOL[selected.length % GUIDE_POOL.length]} 가이드`;
    poi.visitOrder = selected.length + 1;
    selected.push(poi);
    poi.keywords.forEach((k) => usedCategories.add(k));
    return true;
  };

  // 1순위: 점수 높고 새로운 카테고리를 더하는 POI 우선
  for (const poi of scored) {
    if (selected.length >= maxPoints) break;
    const addsDiversity = poi.keywords.some((k) => !usedCategories.has(k));
    if (selected.length === 0 || addsDiversity) addPoi(poi);
  }
  // 2순위: 아직 minPoints 못 채웠으면 점수순으로 보충
  if (selected.length < minPoints) {
    for (const poi of scored) {
      if (selected.length >= maxPoints) break;
      if (!selected.includes(poi)) addPoi(poi);
    }
  }

  steps.push({
    id: "select",
    title: "7. 최종 가이드 포인트 선정",
    source: `점수순 + 카테고리 다양성 + ${tourBudgetMin}분 투어 예산`,
    metrics: {
      selected: selected.length,
      totalDurationMin: budgetMin,
      categories: [...usedCategories],
    },
    summary: `${selected.length}개 포인트 선정 (예상 소요 ${budgetMin}분, 커버 키워드 ${usedCategories.size}종)`,
  });

  return {
    region: { areaCode, sigunguCode, sigunguName },
    conditions: {
      contentTypeIds,
      radiusKm,
      minPoints,
      maxPoints,
      preferredKeywords,
      tourBudgetMin,
    },
    center,
    sourceMode,
    steps,
    candidates: scored,
    selected,
  };
}

module.exports = {
  runSelectionPipeline,
  haversineKm,
  CONTENT_TYPE_LABEL,
  GYEONGBUK_SIGUNGU,
};
