// TourAPI 운영시간·휴무일 자유 텍스트 파서
//
// ── 이 파일의 원칙 ──────────────────────────────────────────────────
// **못 읽으면 못 읽었다고 한다.** 09:00~18:00 같은 가짜 기본값을 여기서 만들지 않는다.
// 폴백이 필요하면 그건 정책이므로 호출하는 쪽(durationResolver/파이프라인)이 결정하고,
// 그 사실을 source 에 남긴다.
//
// TourAPI usetime 은 자유 텍스트라 형태가 제각각이다:
//   "09:00~18:00"
//   "09:00 ~ 18:00 (동절기 09:00~17:00)"
//   "상시개방"  "연중무휴"  "24시간"
//   "일출~일몰"  "제한없음"
//   "하절기(3~10월) 09:00~18:00 / 동절기(11~2월) 09:00~17:00"

const DAY_NAMES = {
  월: "MON", 화: "TUE", 수: "WED", 목: "THU",
  금: "FRI", 토: "SAT", 일: "SUN",
};

// 자정 기준 분으로 변환. 24:00 은 1440 으로 허용한다.
function toMinutes(hour, minute) {
  const h = Number(hour);
  const m = Number(minute || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

// 겹치거나 인접한 구간을 합치고 시작시각 순으로 정렬한다.
function mergeWindows(windows) {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

/**
 * 운영시간 문자열을 분 단위 구간으로 변환한다.
 *
 * @returns {{ windows: Array<{start:number,end:number}>|null, source: string, raw: string|null }}
 *   source: "parsed"       — 텍스트에서 시각을 읽어냄
 *           "always_open"  — 상시개방/24시간
 *           "unknown"      — 읽어내지 못함 (windows = null)
 */
function parseOperatingHours(rawText) {
  const raw = rawText == null ? null : String(rawText).trim();

  if (!raw) return { windows: null, source: "unknown", raw: null };

  // ── 상시개방 계열 ──
  // "연중무휴"만 있는 건 휴무일 정보이지 개장시간이 아니므로 여기서 제외한다.
  if (/(상시\s*개방|상시|24\s*시간|연중\s*개방|제한\s*없음|자유\s*관람)/.test(raw)) {
    return { windows: [{ start: 0, end: 1440 }], source: "always_open", raw };
  }

  // ── "09:00~18:00" / "09시~18시" / "9:00 - 18:00" ──
  // 시:분 또는 시 단위 모두 허용. 구분자는 ~ - – — 및 "부터/까지".
  const rangeRe =
    /(\d{1,2})\s*(?::|시)\s*(\d{2})?\s*분?\s*(?:~|-|–|—|부터|to)\s*(\d{1,2})\s*(?::|시)\s*(\d{2})?\s*분?/g;

  const windows = [];
  let match;
  while ((match = rangeRe.exec(raw)) !== null) {
    const start = toMinutes(match[1], match[2]);
    const end = toMinutes(match[3], match[4]);
    if (start == null || end == null) continue;
    // 종료가 시작보다 이르면(자정 넘김 등) 투어 일정에 쓸 수 없으므로 버린다.
    if (end <= start) continue;
    windows.push({ start, end });
  }

  if (windows.length > 0) {
    return { windows: mergeWindows(windows), source: "parsed", raw };
  }

  // ── 읽을 수 없음 ──
  // "일출~일몰", "문의", "홈페이지 참조" 등. 지어내지 않는다.
  return { windows: null, source: "unknown", raw };
}

/**
 * 휴무일 문자열을 요일 코드로 변환한다.
 *
 * @returns {{ rest_days: string[]|null, always_open: boolean, source: string, raw: string|null }}
 *   rest_days: ["MON"] 형태. 연중무휴면 빈 배열. 못 읽으면 null.
 */
function parseRestDate(rawText) {
  const raw = rawText == null ? null : String(rawText).trim();

  if (!raw) return { rest_days: null, always_open: false, source: "unknown", raw: null };

  if (/(연중\s*무휴|무휴|없음|연중\s*개방)/.test(raw)) {
    return { rest_days: [], always_open: true, source: "parsed", raw };
  }

  // "매주 월요일", "월,화 휴무", "월요일 휴관"
  const found = new Set();
  const dayRe = /([월화수목금토일])\s*요일/g;
  let m;
  while ((m = dayRe.exec(raw)) !== null) {
    found.add(DAY_NAMES[m[1]]);
  }

  // "월,화" 처럼 요일 글자만 나열된 경우
  if (found.size === 0) {
    const listMatch = /([월화수목금토일])(?:\s*[,·/]\s*([월화수목금토일]))*\s*(?:휴무|휴관|정기휴무)/.exec(raw);
    if (listMatch) {
      for (const ch of raw) {
        if (DAY_NAMES[ch]) found.add(DAY_NAMES[ch]);
      }
    }
  }

  if (found.size > 0) {
    return { rest_days: [...found], always_open: false, source: "parsed", raw };
  }

  // "설날·추석 당일", "동절기 휴관" 등 요일로 환원되지 않는 것은 미상 처리
  return { rest_days: null, always_open: false, source: "unknown", raw };
}

/**
 * 정규화된 POI 에 파싱 결과를 채운다. (poiNormalizer 가 비워 둔 자리)
 * 값을 못 읽어도 폴백을 넣지 않는다 — null 인 채로 두고 source 에 이유를 남긴다.
 */
function applyOperatingHours(poi) {
  if (!poi) return poi;

  const hours = parseOperatingHours(poi.use_time_raw);
  const rest = parseRestDate(poi.rest_date_raw);

  poi.open_windows = hours.windows;
  poi.rest_days = rest.rest_days;
  poi.sources.hours = hours.source;
  poi.sources.rest_days = rest.source;

  return poi;
}

module.exports = {
  parseOperatingHours,
  parseRestDate,
  applyOperatingHours,
  toMinutes,
  mergeWindows,
};
