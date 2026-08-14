// 권역별 GUIDE_HUB 후보 조합 탐색 (selectionPipeline STEP 7)
//
// ── 이 파일이 하는 일 ────────────────────────────────────────────
// "좋은 장소에 점수를 매기는 것"이 아니다.
// **운영 가능한 조합 중 `다양성 ↔ 이동 효율` trade-off 를 보존하면서
//   후보를 줄이고, 데이터가 불확실한 부분은 별도로 표시한다.**
//
// 가중치·배점을 만들지 않는다. 이전 파이프라인이 40/36/20/6 임의 배점으로
// 실패했던 자리이므로, 임의값이 다시 들어갈 수 없는 구조로 짠다.
//
// ── 왜 전수 열거를 안 하는가 ─────────────────────────────────────
// 경주 권역1 은 GUIDE_HUB 가 104개다. C(104,5) = 91,962,520.
// 안동 69개 → 1,124만, 포항 84개 → 3,087만. 청송(31개)만 겨우 가능하다.
//
// ── 그래서 커버리지 분해 ─────────────────────────────────────────
// 관광 선호 카테고리는 5종이고, GUIDE_HUB 만 보면 실제로는 3종
// (자연/역사·문화/체험 — 음식은 ROUTE_STOP, 시장은 미수집)이다.
// 즉 category_coverage 는 작은 정수라 **2축 Pareto front 의 점 개수가
// 커버리지 값의 가짓수를 넘을 수 없다.**
//
// 따라서 각 커버리지 수준 c 마다 "coverage >= c 를 만족하는 최소 diameter"
// 를 구하면 front 전체가 나온다. 전수 열거와 **결과가 동일한 정확 해법**이며
// 근사도 임의 상한도 없다. (검증: verifyAgainstBruteForce)

// ---------- 조합 지표 ----------

// 무방향 pair 조회용 키. 1차 패스의 pairs 는 i<j 로만 저장돼 있다.
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * pairs 배열을 조회용 Map 으로. 방향쌍이 들어오면 더 큰 값을 남긴다.
 *
 * 왕복 시간이 다를 수 있고(일방통행·좌회전 금지), 조합 평가는 보수적이어야
 * 한다 — 이동시간을 짧게 잡으면 현실에서 못 지키는 일정이 나온다.
 */
function buildPairIndex(pairs) {
  const index = new Map();

  for (const pair of pairs || []) {
    const key = pairKey(pair.i, pair.j);
    const prev = index.get(key);
    if (!prev || pair.travel_min > prev.travel_min) {
      index.set(key, pair);
    }
  }
  return index;
}

function lookupPair(index, a, b) {
  return index.get(pairKey(a, b)) || null;
}

/** 중앙값. 정렬된 배열을 받는다. */
function medianOf(sorted) {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * 조합 하나의 측정값을 낸다. **점수가 아니라 측정값이다.**
 * 어느 항목도 가중합되지 않는다.
 *
 * @param {number[]} indexes  matrixPoints 상의 인덱스
 * @param {Map} pairIndex
 * @param {Map<number, object>} poiByIndex  인덱스 → POI
 */
function measureCombination(indexes, pairIndex, poiByIndex) {
  const members = indexes.map((i) => poiByIndex.get(i)).filter(Boolean);

  // ── 이동 연결성 ──
  const minutes = [];
  const providerCount = {};
  let missingPair = 0;

  for (let a = 0; a < indexes.length; a += 1) {
    for (let b = a + 1; b < indexes.length; b += 1) {
      const pair = lookupPair(pairIndex, indexes[a], indexes[b]);
      if (!pair) {
        missingPair += 1;
        continue;
      }
      minutes.push(pair.travel_min);
      providerCount[pair.source] = (providerCount[pair.source] || 0) + 1;
    }
  }
  minutes.sort((x, y) => x - y);

  const pairTotal = minutes.length;
  const kakaoCount = Object.entries(providerCount)
    .filter(([source]) => source.startsWith("kakao"))
    .reduce((sum, [, n]) => sum + n, 0);

  // ── 카테고리 다양성 ──
  // 실제 구성까지 남긴다. coverage 숫자만으로는 "자연 4개"와
  // "자연2·역사1·체험1"이 구분되지 않는다.
  const categoryDistribution = {};
  for (const poi of members) {
    const key = poi.preference_category || "(미매핑)";
    categoryDistribution[key] = (categoryDistribution[key] || 0) + 1;
  }
  const mappedCategories = members
    .map((p) => p.preference_category)
    .filter(Boolean);
  const coverage = new Set(mappedCategories).size;
  const maxSameCategory = Math.max(
    0,
    ...Object.entries(categoryDistribution)
      .filter(([key]) => key !== "(미매핑)")
      .map(([, n]) => n)
  );

  // ── 데이터 신뢰도 ──
  // **선정 점수에 넣지 않는다.** needs_review 판단에만 쓴다.
  const size = members.length || 1;
  const hoursKnown = members.filter(
    (p) => p.open_windows != null && p.open_windows.length > 0
  ).length;
  const durationPolicy = members.filter(
    (p) => p.sources?.duration === "policy" || p.sources?.duration === "default"
  ).length;
  const categoryMapped = members.filter((p) => p.preference_category != null).length;

  const reviewReasons = [];
  if (hoursKnown < size) reviewReasons.push(`operating_hours_unknown:${size - hoursKnown}`);
  if (categoryMapped < size) reviewReasons.push(`category_unmapped:${size - categoryMapped}`);
  if (durationPolicy > 0) reviewReasons.push(`duration_policy:${durationPolicy}`);
  if (kakaoCount < pairTotal) {
    reviewReasons.push(`travel_estimated:${pairTotal - kakaoCount}/${pairTotal}`);
  }
  if (missingPair > 0) reviewReasons.push(`travel_pair_missing:${missingPair}`);

  return {
    poi_ids: members.map((p) => p.content_id),
    poi_names: members.map((p) => p.title),
    candidate_size: members.length,

    category_distribution: categoryDistribution,
    category_coverage: coverage,
    max_same_category: maxSameCategory,

    max_pair_travel_min: pairTotal ? minutes[minutes.length - 1] : null,
    // 가장 가까운 두 거점 사이 시간. 이 값이 작으면 거점이 사실상 겹친다
    // — 가이드 4명이 같은 곳에 서 있는 조합을 잡아낸다.
    min_pair_travel_min: pairTotal ? minutes[0] : null,
    mean_pair_travel_min: pairTotal
      ? Math.round(minutes.reduce((s, m) => s + m, 0) / pairTotal)
      : null,
    median_pair_travel_min: medianOf(minutes),
    travel_provider_distribution: providerCount,
    kakao_route_ratio: pairTotal ? Number((kakaoCount / pairTotal).toFixed(2)) : 0,

    data_quality: {
      operating_hours_known_ratio: Number((hoursKnown / size).toFixed(2)),
      duration_policy_ratio: Number((durationPolicy / size).toFixed(2)),
      category_mapped_ratio: Number((categoryMapped / size).toFixed(2)),
    },
    needs_review: reviewReasons.length > 0,
    review_reasons: reviewReasons,
  };
}

// ---------- 1. 자격 필터 ----------

/**
 * 거점 후보 자격을 판정한다. **점수가 아니라 통과/탈락이다.**
 * unknown 은 탈락시키지 않는다 — needs_review 로만 표시하고 후보에 남긴다.
 *
 * @returns {{candidates: object[], rejected: object[]}}
 */
function filterHubCandidates(pois, { pairIndex = null } = {}) {
  const candidates = [];
  const rejected = [];

  for (const poi of pois || []) {
    const reasons = [];

    if (poi.poi_role !== "GUIDE_HUB") reasons.push("not_guide_hub");

    // 좌표·이동시간 계산 가능 여부는 STEP 4 가 이미 판정했다. 다시 구현하지 않는다.
    if (poi.viability?.status === "unavailable") {
      reasons.push(...(poi.viability.reasons || ["unavailable"]));
    }

    // 명시적 운영 불가.
    // TourAPI 에 폐업·운영중단 필드가 없어 현재 신호가 없다. 훅만 둔다.
    if (poi.operating_status === "closed") reasons.push("explicitly_closed");

    // 행렬에 자리가 없으면 이동시간을 못 재므로 조합에 넣을 수 없다.
    if (pairIndex && poi.__matrixIndex == null) reasons.push("not_in_travel_matrix");

    if (reasons.length > 0) {
      rejected.push({ content_id: poi.content_id, title: poi.title, reasons });
    } else {
      candidates.push(poi);
    }
  }

  return { candidates, rejected };
}

// ---------- 3. k-clique 존재 판정 ----------

/**
 * "모든 쌍이 [minSeparation, threshold] 안이고 requiredCategories 를 전부 포함하는
 *  크기 k 조합"을 찾는다.
 *
 * 상한(threshold)은 diameter 제약이고, 하한(minSeparation)은 거점이 서로
 * 너무 붙지 않게 하는 제약이다. 둘 다 "모든 쌍" 조건이라 clique 탐색이다.
 * k 가 4~5 로 아주 작아 인접 교집합 가지치기 DFS 로 충분하다.
 *
 * 개수(>= c)가 아니라 **집합 포함(⊇ S)** 으로 받는 이유:
 * 카테고리마다 수요가 다르므로 "3종 덮음"은 어떤 3종인지에 따라 가치가 다르다.
 * {자연, 역사·문화, 체험} 과 {음식, 시장, 체험} 은 개수가 같아도 수요가 다르다.
 *
 * @param {Set<string>} requiredCategories  비어 있으면 카테고리 제약 없음
 * @param {number} collectLimit    0 이면 첫 해만 찾고 즉시 종료(존재 판정)
 * @param {number} minSeparation   0 이면 하한 없음
 * @returns {number[][]} 찾은 조합들
 */
function findCliques(
  indexes,
  pairIndex,
  categoryByIndex,
  k,
  threshold,
  requiredCategories,
  collectLimit = 0,
  minSeparation = 0
) {
  const found = [];
  const n = indexes.length;
  if (n < k) return found;

  const required = requiredCategories instanceof Set
    ? requiredCategories
    : new Set(requiredCategories || []);

  // 인접: [minSeparation, threshold] 구간 안에서 이어지는가
  const adjacent = (a, b) => {
    const pair = lookupPair(pairIndex, a, b);
    return (
      pair != null && pair.travel_min <= threshold && pair.travel_min >= minSeparation
    );
  };

  const chosen = [];

  // 남은 후보로 아직 못 채운 필수 카테고리를 전부 공급할 수 있는지.
  // 못 하면 즉시 가지치기한다.
  function canStillReach(currentCats, remaining, slotsLeft) {
    const missing = [...required].filter((c) => !currentCats.has(c));
    if (missing.length === 0) return true;
    if (missing.length > slotsLeft) return false;

    const supply = new Set();
    for (const idx of remaining) {
      const cat = categoryByIndex.get(idx);
      if (cat && missing.includes(cat)) supply.add(cat);
    }
    return supply.size >= missing.length;
  }

  function dfs(pool, cats) {
    if (chosen.length === k) {
      const covered = [...required].every((c) => cats.has(c));
      if (covered) found.push([...chosen]);
      return found.length > collectLimit;
    }

    const slotsLeft = k - chosen.length;
    if (pool.length < slotsLeft) return false;
    if (!canStillReach(cats, pool, slotsLeft)) return false;

    for (let p = 0; p <= pool.length - slotsLeft; p += 1) {
      const pick = pool[p];
      // pick 이후 원소 중 pick 과 인접한 것만 남긴다 → 자동으로 clique 유지
      const nextPool = pool.slice(p + 1).filter((other) => adjacent(pick, other));

      const cat = categoryByIndex.get(pick);
      const added = cat && !cats.has(cat);
      if (added) cats.add(cat);
      chosen.push(pick);

      const stop = dfs(nextPool, cats);

      chosen.pop();
      if (added) cats.delete(cat);

      if (stop) return true;
    }
    return false;
  }

  dfs([...indexes], new Set());
  return found;
}

// ---------- 4. Pareto front (커버리지 분해) ----------

/**
 * 2축 Pareto front 를 구한다.
 *   maximize demand_covered   (설문 집단 선호 기반. 설문이 없으면 카테고리 개수와 동치)
 *   minimize max_pair_travel_min (diameter)
 *
 * ── 왜 부분집합으로 분해하는가 ─────────────────────────────────
 * 카테고리가 5종뿐이라 **부분집합이 최대 32개**다. 각 부분집합 S 마다
 * "S 를 전부 덮는 최소 diameter" 를 구하면 front 전체가 나온다.
 * 전수 열거와 결과가 같은 정확 해법이며, 수요 가중을 넣어도 성질이 유지된다.
 *
 * 개수 기반(>= c)으로 하면 "3종 덮음"이 어떤 3종인지 구분하지 못해
 * 수요가 반영되지 않는다.
 *
 * @param {Object<string,number>} demand  카테고리별 수요. null 이면 균등(=개수)
 * @returns {Array<{categories, category_coverage, demand_covered, max_pair_travel_min}>}
 */
function findParetoFront(
  indexes,
  pairIndex,
  categoryByIndex,
  k,
  { minSeparation = 0, demand = null } = {}
) {
  if (indexes.length < k) return [];

  // 후보 안에서 실제로 나타나는 이동시간만 이분탐색 대상으로 삼는다.
  const thresholds = new Set();
  for (let a = 0; a < indexes.length; a += 1) {
    for (let b = a + 1; b < indexes.length; b += 1) {
      const pair = lookupPair(pairIndex, indexes[a], indexes[b]);
      if (!pair) continue;
      if (pair.travel_min < minSeparation) continue;
      thresholds.add(pair.travel_min);
    }
  }
  const sortedThresholds = [...thresholds].sort((x, y) => x - y);
  if (sortedThresholds.length === 0) return [];

  const availableCats = [
    ...new Set(indexes.map((i) => categoryByIndex.get(i)).filter(Boolean)),
  ];

  // 수요 없으면 각 카테고리를 1 로 본다 → demand_covered 가 곧 개수가 된다.
  const weightOf = (category) => (demand ? demand[category] || 0 : 1);
  const demandOfSet = (set) =>
    Number([...set].reduce((sum, c) => sum + weightOf(c), 0).toFixed(4));

  // 부분집합 전수 (2^n, n<=5). 크기가 k 를 넘으면 어차피 못 담는다.
  const subsets = [];
  for (let mask = 0; mask < 1 << availableCats.length; mask += 1) {
    const set = availableCats.filter((_, i) => mask & (1 << i));
    if (set.length > k) continue;
    subsets.push(set);
  }
  // 수요 높은 집합부터 — 지배 제거가 쉬워진다.
  subsets.sort((a, b) => demandOfSet(b) - demandOfSet(a));

  const feasibleAt = (threshold, required) =>
    findCliques(
      indexes, pairIndex, categoryByIndex, k, threshold, required, 0, minSeparation
    ).length > 0;

  const points = [];
  for (const set of subsets) {
    const required = new Set(set);

    // 최대 threshold 로도 불가능하면 이 집합은 달성 불가
    if (!feasibleAt(sortedThresholds[sortedThresholds.length - 1], required)) continue;

    let lo = 0;
    let hi = sortedThresholds.length - 1;
    let best = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (feasibleAt(sortedThresholds[mid], required)) {
        best = sortedThresholds[mid];
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    if (best != null) {
      points.push({
        categories: set,
        category_coverage: set.length,
        demand_covered: demandOfSet(required),
        max_pair_travel_min: best,
      });
    }
  }

  // 지배 제거: 수요가 더 높은데 diameter 가 같거나 작으면 아래 점은 지배당한다.
  points.sort(
    (a, b) => b.demand_covered - a.demand_covered || a.max_pair_travel_min - b.max_pair_travel_min
  );

  const front = [];
  let bestDiameterSoFar = Infinity;
  for (const point of points) {
    if (point.max_pair_travel_min < bestDiameterSoFar) {
      front.push(point);
      bestDiameterSoFar = point.max_pair_travel_min;
    }
  }
  return front;
}

// ---------- 5. 대표 조합 수집 ----------

/**
 * Pareto 점마다 실제 조합을 뽑는다.
 * 동률(같은 coverage·diameter)은 mean → median 순으로 정렬해 상위 N개만.
 */
function collectRepresentatives(
  front,
  indexes,
  pairIndex,
  categoryByIndex,
  poiByIndex,
  k,
  { perPoint = 3, searchCap = 2000, minSeparation = 0, demand = null } = {}
) {
  const results = [];

  for (const point of front) {
    const cliques = findCliques(
      indexes,
      pairIndex,
      categoryByIndex,
      k,
      point.max_pair_travel_min,
      new Set(point.categories),
      searchCap,
      minSeparation
    );

    const measured = cliques
      .map((combo) => measureCombination(combo, pairIndex, poiByIndex))
      // 이분탐색은 "⊇ S" 를 보장하므로 더 넓은 집합도 섞여 들어온다.
      // 그건 상위 Pareto 점이 담당하므로 여기서는 정확히 S 인 것만 남긴다.
      .filter((m) => {
        const covered = Object.keys(m.category_distribution).filter((c) => c !== "(미매핑)");
        return (
          covered.length === point.categories.length &&
          point.categories.every((c) => covered.includes(c))
        );
      })
      .filter((m) => m.max_pair_travel_min === point.max_pair_travel_min)
      .sort(
        (a, b) =>
          a.mean_pair_travel_min - b.mean_pair_travel_min ||
          a.median_pair_travel_min - b.median_pair_travel_min
      );

    results.push(
      ...measured.slice(0, perPoint).map((m) => ({
        ...m,
        demand_covered: point.demand_covered,
        pareto_point: {
          categories: point.categories,
          category_coverage: point.category_coverage,
          demand_covered: point.demand_covered,
          max_pair_travel_min: point.max_pair_travel_min,
        },
        // searchCap 에 걸렸으면 대표 선택이 전수가 아닐 수 있다. 숨기지 않는다.
        representative_search_truncated: cliques.length > searchCap,
      }))
    );
  }

  return results;
}

// ---------- 진입점 ----------

/**
 * 권역 하나에서 크기 k 후보 조합을 구한다.
 *
 * @param {object[]} regionPois   권역 소속 POI (matrixIndex 가 붙어 있어야 함)
 * @param {object[]} pairs        STEP 5 의 pairs
 * @param {number} k              4 또는 5
 */
function selectHubCandidates(regionPois, pairs, k, options = {}) {
  const pairIndex = buildPairIndex(pairs);
  const { candidates, rejected } = filterHubCandidates(regionPois, { pairIndex });

  const indexes = candidates.map((p) => p.__matrixIndex);
  const categoryByIndex = new Map(
    candidates.map((p) => [p.__matrixIndex, p.preference_category || null])
  );
  const poiByIndex = new Map(candidates.map((p) => [p.__matrixIndex, p]));

  if (indexes.length < k) {
    return {
      candidate_size: k,
      eligible: candidates.length,
      rejected,
      pareto_front: [],
      combinations: [],
      note: `후보 ${candidates.length}개로 ${k}개 조합을 만들 수 없음`,
    };
  }

  const { minSeparation = 0, demand = null } = options;

  const front = findParetoFront(indexes, pairIndex, categoryByIndex, k, {
    minSeparation,
    demand,
  });
  const combinations = collectRepresentatives(
    front,
    indexes,
    pairIndex,
    categoryByIndex,
    poiByIndex,
    k,
    options
  );

  return {
    candidate_size: k,
    eligible: candidates.length,
    min_separation_min: minSeparation,
    rejected,
    pareto_front: front,
    combinations,
  };
}

/**
 * 최소 이격을 여러 값으로 바꿔 가며 조합이 얼마나 남는지 관측한다.
 *
 * **여기서 기준을 정하지 않는다.** 15분 권역 기준을 정할 때처럼
 * 분포를 먼저 보고 사람이 정한다. 이격 없이 최적화하면 거점 4곳이
 * 같은 관광단지 안으로 수렴한다(경주 보문단지, 청송 읍내).
 */
function probeSeparations(regionPois, pairs, k, separations, options = {}) {
  const result = {};

  for (const separation of separations) {
    const outcome = selectHubCandidates(regionPois, pairs, k, {
      ...options,
      minSeparation: separation,
    });

    const best = outcome.pareto_front[0] || null;
    result[separation] = {
      feasible: outcome.pareto_front.length > 0,
      paretoPoints: outcome.pareto_front.length,
      bestDemandCovered: best ? best.demand_covered : null,
      bestCoverage: best ? best.category_coverage : null,
      diameterAtBest: best ? best.max_pair_travel_min : null,
      combinations: outcome.combinations.length,
    };
  }
  return result;
}

// ---------- 검증용 브루트포스 ----------

/**
 * 전수 열거로 Pareto front 를 구한다. **작은 권역 검증 전용.**
 * 커버리지 분해 결과가 이것과 같아야 "전수와 동일"이라는 주장이 성립한다.
 */
function bruteForceParetoFront(
  indexes,
  pairIndex,
  categoryByIndex,
  k,
  { minSeparation = 0, demand = null } = {}
) {
  const combos = [];
  const pick = [];

  (function walk(start) {
    if (pick.length === k) {
      combos.push([...pick]);
      return;
    }
    for (let i = start; i < indexes.length; i += 1) {
      pick.push(indexes[i]);
      walk(i + 1);
      pick.pop();
    }
  })(0);

  const weightOf = (category) => (demand ? demand[category] || 0 : 1);

  const points = [];
  for (const combo of combos) {
    let diameter = 0;
    let ok = true;
    for (let a = 0; a < combo.length && ok; a += 1) {
      for (let b = a + 1; b < combo.length; b += 1) {
        const pair = lookupPair(pairIndex, combo[a], combo[b]);
        if (!pair || pair.travel_min < minSeparation) {
          ok = false;
          break;
        }
        diameter = Math.max(diameter, pair.travel_min);
      }
    }
    if (!ok) continue;

    const cats = [...new Set(combo.map((i) => categoryByIndex.get(i)).filter(Boolean))];
    points.push({
      categories: cats.sort(),
      category_coverage: cats.length,
      demand_covered: Number(cats.reduce((s, c) => s + weightOf(c), 0).toFixed(4)),
      max_pair_travel_min: diameter,
    });
  }

  // 카테고리 집합별 최소 diameter → 지배 제거
  const bestBySet = new Map();
  for (const p of points) {
    const key = p.categories.join("|");
    const prev = bestBySet.get(key);
    if (prev == null || p.max_pair_travel_min < prev.max_pair_travel_min) {
      bestBySet.set(key, p);
    }
  }

  const sorted = [...bestBySet.values()].sort(
    (a, b) => b.demand_covered - a.demand_covered || a.max_pair_travel_min - b.max_pair_travel_min
  );

  const front = [];
  let bestDiameterSoFar = Infinity;
  for (const point of sorted) {
    if (point.max_pair_travel_min < bestDiameterSoFar) {
      front.push(point);
      bestDiameterSoFar = point.max_pair_travel_min;
    }
  }
  return front;
}

module.exports = {
  selectHubCandidates,
  probeSeparations,
  filterHubCandidates,
  findParetoFront,
  collectRepresentatives,
  measureCombination,
  findCliques,
  buildPairIndex,
  lookupPair,
  bruteForceParetoFront,
};
