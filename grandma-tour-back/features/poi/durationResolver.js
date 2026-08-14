// POI 체류시간(duration_min) 결정
//
// 결정 순서:
//   1. TourAPI 가 명시한 소요시간 (여행코스의 taketime 등)
//   2. 상세정보 텍스트에서 파싱 ("관람 소요시간 약 40분")
//   3. 정책 기본값 (contentTypeId 별)
//
// 반환할 때 근거(source)를 함께 준다. 3번으로 떨어진 비율이 높으면
// 그만큼 CP-SAT 의 시간창 제약이 추측 위에 서 있다는 뜻이므로 반드시 드러나야 한다.
//
// ── 알려진 한계 ──────────────────────────────────────────────────
// 공공 데이터에 "이 명소를 둘러보는 데 몇 분 걸리는가"는 사실상 없다.
// 대부분 3번(정책 기본값)으로 떨어질 것으로 예상되며, 이 값들은 근거 없는
// 임의값이다. 실제 운영 데이터가 쌓이면 교체해야 한다.
// (docs/poi-selection-spec.md STEP 6 참조)

// contentTypeId 별 정책 기본값(분). **임의값 — 튜닝 대상.**
const POLICY_DURATION = {
  12: 90, // 관광지
  14: 60, // 문화시설
  15: 60, // 축제/행사
  25: 90, // 여행코스
  28: 60, // 레포츠
  38: 40, // 쇼핑
  39: 40, // 음식점
};

const DEFAULT_DURATION_MIN = 60;

// 어르신 상주 투어 특성상 지나치게 길거나 짧은 값은 신뢰하지 않는다.
const MIN_REASONABLE = 15;
const MAX_REASONABLE = 240;

/**
 * "약 1시간 30분", "40분 소요", "2시간" 같은 텍스트에서 분을 뽑는다.
 * @returns {number|null}
 */
function parseDurationText(rawText) {
  const raw = rawText == null ? "" : String(rawText);
  if (!raw.trim()) return null;

  let total = null;

  // "1시간 30분" / "1시간30분" / "2시간"
  const hourMatch = /(\d{1,2})\s*시간\s*(?:(\d{1,2})\s*분)?/.exec(raw);
  if (hourMatch) {
    total = Number(hourMatch[1]) * 60 + Number(hourMatch[2] || 0);
  }

  // "40분" (시간 표기가 없을 때만)
  if (total == null) {
    const minMatch = /(\d{1,3})\s*분/.exec(raw);
    if (minMatch) total = Number(minMatch[1]);
  }

  if (total == null || !Number.isFinite(total)) return null;
  if (total < MIN_REASONABLE || total > MAX_REASONABLE) return null;
  return total;
}

/**
 * 체류시간을 결정한다.
 *
 * @param {object} poi   poiNormalizer 가 만든 POI (raw.intro / raw.common 포함)
 * @returns {{ value: number, source: "tourapi"|"parsed"|"policy"|"default" }}
 */
function resolveDuration(poi) {
  if (!poi) {
    return { value: DEFAULT_DURATION_MIN, source: "default" };
  }

  const intro = poi.raw?.intro || {};
  const common = poi.raw?.common || {};

  // ── 1. TourAPI 명시 필드 ──
  // 여행코스(25)의 taketime 이 대표적. 그 외 타입엔 사실상 없다.
  const explicit =
    intro.taketime ?? intro.taketimeleports ?? common.taketime ?? null;
  if (explicit != null) {
    const parsed = parseDurationText(explicit);
    if (parsed != null) return { value: parsed, source: "tourapi" };
  }

  // ── 2. 상세 텍스트에서 파싱 ──
  // 소요시간을 언급한 문장이 있을 때만 본다. 개요 전체에서 "분"을 찾으면
  // "10분 거리에 위치" 같은 무관한 숫자를 잡으므로 문맥을 좁힌다.
  const candidates = [
    intro.usetime, intro.usetimeculture, intro.usetimeleports,
    intro.expguide, common.overview,
  ].filter(Boolean);

  for (const textValue of candidates) {
    const contextMatch =
      /(?:소요\s*시간|관람\s*시간|체험\s*시간|소요)[^\d]{0,10}([^.\n]{0,20})/.exec(
        String(textValue)
      );
    if (!contextMatch) continue;
    const parsed = parseDurationText(contextMatch[1]);
    if (parsed != null) return { value: parsed, source: "parsed" };
  }

  // ── 3. 정책 기본값 ──
  const policy = POLICY_DURATION[poi.content_type_id];
  if (policy != null) return { value: policy, source: "policy" };

  return { value: DEFAULT_DURATION_MIN, source: "default" };
}

/**
 * 정규화된 POI 에 체류시간을 채운다. (poiNormalizer 가 비워 둔 자리)
 */
function applyDuration(poi) {
  if (!poi) return poi;

  const { value, source } = resolveDuration(poi);
  poi.duration_min = value;
  poi.sources.duration = source;

  return poi;
}

module.exports = {
  resolveDuration,
  applyDuration,
  parseDurationText,
  POLICY_DURATION,
};
