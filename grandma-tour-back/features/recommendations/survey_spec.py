# 설문v3 스펙 — 코스 추천이 설문에서 읽는 값의 단일 정의점
#
# ── 이 파일이 존재하는 이유 ──────────────────────────────────────
# 지금 설문 항목의 정의가 세 군데에 흩어져 있다.
#   database/init.sql              컬럼과 타입
#   features/survey/controller.js  입력 검증 규칙
#   features/recommendations/recommender.py  실제로 읽는 키
# 셋이 어긋나도 아무도 알아채지 못한다. 실제로 `budget` 은 앞의 둘에만 있고
# 세 번째에는 없다 — 즉 사용자가 답한 값이 조용히 버려지고 있다.
#
# 이 파일은 **세 번째 관점**을 명시한다: "추천 알고리즘이 무엇을 필요로 하는가".
# 알고리즘이 쓰지 않는 항목은 여기 없거나, 있더라도 kind="unused" 로 표시된다.
#
# ── 두 가지를 한 곳에 적는다 ─────────────────────────────────────
#   1. 무엇을 물어봐야 하는가  → FIELD_CATALOG (문항 메타데이터)
#   2. 그 답을 어디에 쓰는가    → FIELD_CATALOG[*]["used_by"] / ["kind"]
# 프론트의 설문 화면도, CP-SAT 모델도 이 표를 근거로 만든다.
# 표에 없는 값을 솔버가 읽기 시작하면 그때 이 파일을 먼저 고친다.

from dataclasses import dataclass, asdict
from typing import Any, Optional

MINUTES_IN_DAY = 24 * 60

# ── 어휘 ─────────────────────────────────────────────────────────
# DB ENUM 과 반드시 같아야 한다. 어긋나면 INSERT 가 런타임에 깨진다.
MOBILITY_LEVELS = ("low", "normal", "high")
TRANSPORT_MODES = ("walking", "car", "taxi", "public_transit")

# 식사 제약이 붙잡을 키워드. 002 마이그레이션 이후 preference 어휘 5종 중 하나다.
# id 가 아니라 **이름**으로 지정한다 — seed 의 id(5)에 의존하면
# 다른 DB 에서 조용히 엉뚱한 키워드를 잡는다.
MEAL_KEYWORD_NAME = "음식"

# 식사 시간창 기본값. ⚠ 임의값이다. "점심은 대개 정오 무렵"이라는 통념일 뿐
# 근거 데이터는 없다. 사용자가 값을 주면 그것을 쓴다.
DEFAULT_MEAL_START_MIN = 11 * 60 + 30   # 11:30
DEFAULT_MEAL_END_MIN = 13 * 60 + 30     # 13:30


# ── 문항 카탈로그 ────────────────────────────────────────────────
# kind 의 의미:
#   hard_constraint  솔버의 제약이 된다. 어기면 해가 나오지 않는다.
#   candidate_filter 모델을 만들기 전에 후보 POI 를 걸러낸다.
#   parameter        제약의 수치를 바꾼다(상한, 버퍼 등).
#   data_source      어떤 데이터를 읽을지 고른다(이동시간 테이블의 mode 등).
#   objective        목적함수의 항에 들어간다.
#   unused           저장은 하지만 추천에 쓰지 않는다. 이유를 함께 적는다.
FIELD_CATALOG = (
    # ── 시간 예산 ────────────────────────────────────────────────
    {
        "key": "start_min",
        "label": "투어 시작 시각",
        "type": "time_min",
        "required": True,
        "kind": "hard_constraint",
        "used_by": (
            "모든 방문 시작 시각의 하한. 출발지 좌표가 있으면 "
            "첫 방문지 도착 = start_min + (출발지→첫 POI 이동시간)."
        ),
    },
    {
        "key": "end_min",
        "label": "투어 종료 시각",
        "type": "time_min",
        "required": True,
        "kind": "hard_constraint",
        "used_by": (
            "마지막 방문 종료 + (마지막 POI→종료지 이동시간) <= end_min. "
            "이 창이 좁으면 해가 없을 수 있고, 그때는 무엇 때문에 좁은지 진단을 낸다."
        ),
    },
    {
        "key": "min_points",
        "label": "최소 방문지 수",
        "type": "int",
        "required": False,
        "default": 2,
        "kind": "hard_constraint",
        "used_by": "선택된 POI 개수의 하한. 코스 길이별로 따로 풀고 결과를 합친다.",
    },
    {
        "key": "max_points",
        "label": "최대 방문지 수",
        "type": "int",
        "required": False,
        "default": 3,
        "kind": "hard_constraint",
        "used_by": "선택된 POI 개수의 상한. 지역 풀 크기와 min() 을 취한다.",
    },

    # ── 선호 ─────────────────────────────────────────────────────
    {
        "key": "selected_keyword_ids",
        "label": "선호 키워드",
        "type": "id_list",
        "required": False,
        "default": (),
        "kind": "objective",
        "used_by": (
            "POI 당 매칭 키워드 수 × MATCH_WEIGHT 로 선호 점수를 만들고, "
            "선호 키워드를 몇 종류나 덮었는지에 커버리지 보너스를 준다. "
            "비어 있으면 선호 항이 0 이 되어 코스가 이동시간만으로 결정된다."
        ),
    },
    {
        "key": "excluded_keyword_ids",
        "label": "제외 키워드",
        "type": "id_list",
        "required": False,
        "default": (),
        "kind": "candidate_filter",
        "used_by": "해당 키워드를 가진 POI 를 모델에 넣기 전에 후보에서 제거한다.",
    },

    # ── 체력 · 동행 (설문v3 신규) ────────────────────────────────
    {
        "key": "mobility_level",
        "label": "보행 / 체력 수준",
        "type": "enum",
        "choices": MOBILITY_LEVELS,
        "required": False,
        "default": "normal",
        "kind": "parameter",
        "used_by": (
            "① 한 구간 최대 이동시간 상한 ② POI 사이 휴식 버퍼(분). "
            "두 값 모두 solver_inputs.MOBILITY_PROFILE 의 임의값이며 튜닝 대상이다. "
            "'normal' 은 설문v2 와 동일한 동작(버퍼 0, 상한 없음)."
        ),
    },
    {
        "key": "party_size",
        "label": "총 인원",
        "type": "int",
        "required": False,
        "default": 1,
        "kind": "unused",
        "used_by": (
            "추천에 쓰지 않는다. POI 정원/가이드 수용 인원 데이터가 없어 "
            "제약을 만들 근거가 없다. 예약·정산과 로그 분석용으로만 저장한다."
        ),
    },
    {
        "key": "has_senior",
        "label": "어르신 동반",
        "type": "bool",
        "required": False,
        "default": False,
        "kind": "parameter",
        "used_by": (
            "mobility_level 과 **별개 축**이다. 체력 등급을 자동으로 낮추지 않는다 "
            "(어르신 동반이 곧 저체력은 아니다). 휴식 버퍼의 하한만 끌어올린다."
        ),
    },
    {
        "key": "has_toddler",
        "label": "유아 동반",
        "type": "bool",
        "required": False,
        "default": False,
        "kind": "parameter",
        "used_by": "has_senior 와 같은 방식으로 휴식 버퍼 하한에만 반영한다.",
    },
    {
        "key": "needs_barrier_free",
        "label": "휠체어 / 유아차 접근 필요",
        "type": "bool",
        "required": False,
        "default": False,
        "kind": "candidate_filter",
        "used_by": (
            "⚠ **현재 동작하지 않는다.** points 테이블에 접근성 컬럼이 없어 "
            "POI 를 판정할 수 없다. TRUE 로 들어오면 필터를 거는 대신 "
            "trace 에 '요구했으나 판정 불가' 경고를 남긴다. "
            "추측으로 걸러내지 않는다 — 잘못 거르면 갈 수 있는 곳을 빼앗는다."
        ),
    },

    # ── 식사 (설문v3 신규) ───────────────────────────────────────
    {
        "key": "needs_meal",
        "label": "식사 포함",
        "type": "bool",
        "required": False,
        "default": False,
        "kind": "hard_constraint",
        "used_by": (
            "TRUE 면 '음식' 키워드 POI 를 최소 1곳 포함하도록 강제하고, "
            "그 방문의 시작 시각을 식사 시간창 안으로 묶는다. "
            "지역 풀에 음식 POI 가 없으면 해가 없어지므로, 모델을 만들기 전에 "
            "먼저 확인해서 '해 없음'이 아니라 '음식 POI 부재'라고 알려 준다."
        ),
    },
    {
        "key": "meal_start_min",
        "label": "식사 희망 시작",
        "type": "time_min",
        "required": False,
        "default": None,
        "kind": "hard_constraint",
        "used_by": f"식사 POI 방문 시작 시각의 하한. NULL 이면 기본값 {DEFAULT_MEAL_START_MIN}분.",
    },
    {
        "key": "meal_end_min",
        "label": "식사 희망 종료",
        "type": "time_min",
        "required": False,
        "default": None,
        "kind": "hard_constraint",
        "used_by": (
            f"식사 POI 방문 **시작** 시각의 상한. NULL 이면 기본값 {DEFAULT_MEAL_END_MIN}분. "
            "종료가 아니라 시작을 묶는 이유: 체류시간이 길면 창 안에 완전히 "
            "가두는 것이 불가능해져 불필요하게 해가 사라진다."
        ),
    },

    # ── 이동 · 기점 (설문v3 신규) ────────────────────────────────
    {
        "key": "transport_mode",
        "label": "이동 수단",
        "type": "enum",
        "choices": TRANSPORT_MODES,
        "required": False,
        "default": "taxi",
        "kind": "data_source",
        "used_by": (
            "travel_time_cache 를 어떤 mode 로 조회할지 고른다. "
            "지금은 service.js 가 'taxi' 를 하드코딩해 설문과 무관하게 조회된다 — "
            "이 값으로 교체한다. 해당 mode 행이 없으면 폴백 이동시간이 쓰이고, "
            "그 사실이 trace 에 남는다."
        ),
    },
    {
        "key": "origin",
        "label": "출발지",
        "type": "place",
        "required": False,
        "default": None,
        "kind": "hard_constraint",
        "used_by": (
            "좌표가 있으면 '출발지→첫 POI' 이동시간을 시간 예산에 넣는다. "
            "없으면 그 구간을 0 으로 두는데, 이는 실제보다 낙관적인 일정이다. "
            "낙관 여부를 trace 에 기록한다."
        ),
    },
    {
        "key": "destination",
        "label": "종료 지점",
        "type": "place",
        "required": False,
        "default": None,
        "kind": "hard_constraint",
        "used_by": (
            "return_to_origin 이면 출발지와 같다고 본다. "
            "'마지막 POI→종료지' 이동시간을 end_min 예산에 넣는다."
        ),
    },

    # ── 저장만 하는 항목 ─────────────────────────────────────────
    {
        "key": "budget",
        "label": "예산",
        "type": "int",
        "required": True,
        "kind": "unused",
        "used_by": (
            "추천에 쓰지 않는다. points 에 가격 컬럼이 없어 "
            "sum(price·x) <= budget 을 세울 수 없다. 없는 가격을 추정해 넣으면 "
            "근거 없는 임의값이 하나 더 늘 뿐이다. "
            "가격 데이터가 생기면 kind 를 hard_constraint 로 바꾸고 solver 에 항을 추가한다."
        ),
    },
)

FIELD_BY_KEY = {f["key"]: f for f in FIELD_CATALOG}


def fields_used_by_solver():
    """솔버가 실제로 읽는 문항만. 화면에서 '이 답이 결과를 바꾼다'를 표시할 때 쓴다."""
    return tuple(f for f in FIELD_CATALOG if f["kind"] != "unused")


def fields_stored_only():
    """저장만 되고 추천에 영향을 주지 않는 문항. 사용자에게 숨기지 말고 이유를 보여 준다."""
    return tuple(f for f in FIELD_CATALOG if f["kind"] == "unused")


# ── 값 객체 ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class Place:
    """출발지/종료지. 좌표가 없으면 이름만 남고 이동시간 계산에서 빠진다."""

    label: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    @property
    def has_coords(self) -> bool:
        return self.lat is not None and self.lng is not None


@dataclass(frozen=True)
class SurveyV3:
    """설문 1건. 솔버는 이 객체만 보고, DB row 나 HTTP body 를 직접 보지 않는다."""

    # 시간 예산
    start_min: int
    end_min: int
    min_points: int
    max_points: int

    # 선호
    selected_keyword_ids: tuple
    excluded_keyword_ids: tuple

    # 체력 · 동행
    mobility_level: str
    party_size: int
    has_senior: bool
    has_toddler: bool
    needs_barrier_free: bool

    # 식사
    needs_meal: bool
    meal_start_min: int
    meal_end_min: int

    # 이동 · 기점
    transport_mode: str
    origin: Optional[Place]
    destination: Optional[Place]

    # 저장만 (솔버 미사용)
    budget: int = 0
    survey_id: Optional[int] = None
    region_id: Optional[int] = None

    @property
    def window_min(self) -> int:
        """투어에 쓸 수 있는 총 분. 실현 가능성 진단의 분모다."""
        return self.end_min - self.start_min

    def to_dict(self) -> dict:
        d = asdict(self)
        d["selected_keyword_ids"] = list(self.selected_keyword_ids)
        d["excluded_keyword_ids"] = list(self.excluded_keyword_ids)
        return d


# ── 파싱 · 검증 ──────────────────────────────────────────────────
#
# 규칙: **값을 고쳐 주지 않는다.** controller.js 가 세운 원칙과 같다.
# 잘못된 입력은 어느 필드가 왜 틀렸는지 돌려주고 멈춘다.
# 예외는 "미응답 → 기본값" 뿐이며, 기본값은 FIELD_CATALOG 에 적힌 것만 쓴다.


class _Errors:
    def __init__(self):
        self.items = []

    def add(self, field: str, message: str):
        self.items.append({"field": field, "message": message})

    def __bool__(self):
        return len(self.items) > 0


def _as_int(raw: Any) -> Optional[int]:
    """정수로 읽는다. 읽을 수 없으면 None (미응답과 구분은 호출부의 몫)."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool):
        return int(raw)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value


def _as_bool(raw: Any, default: bool) -> bool:
    """MySQL 의 0/1, JSON 의 true/false, 폼의 "true"/"1" 을 모두 받는다."""
    if raw is None or raw == "":
        return default
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw != 0
    if isinstance(raw, str):
        return raw.strip().lower() in ("true", "1", "y", "yes", "on")
    return default


def _parse_time_window(raw: dict, errors: _Errors):
    """start_min / end_min. 이 둘이 깨지면 뒤의 모든 제약이 무의미하므로 먼저 본다."""
    start = _as_int(raw.get("start_min"))
    end = _as_int(raw.get("end_min"))

    for name, value in (("start_min", start), ("end_min", end)):
        if value is None:
            errors.add(name, "필수 항목입니다.")
        elif not (0 <= value <= MINUTES_IN_DAY):
            errors.add(name, f"0~{MINUTES_IN_DAY} 분 사이여야 합니다.")

    if start is not None and end is not None and start >= end:
        errors.add("end_min", "종료 시각이 시작 시각보다 늦어야 합니다.")

    return start, end


def _parse_point_count(raw: dict, errors: _Errors):
    """min_points / max_points."""
    lo = _as_int(raw.get("min_points"))
    hi = _as_int(raw.get("max_points"))
    lo = FIELD_BY_KEY["min_points"]["default"] if lo is None else lo
    hi = FIELD_BY_KEY["max_points"]["default"] if hi is None else hi

    if lo < 1:
        errors.add("min_points", "최소 방문지는 1 이상입니다.")
    if hi < 1:
        errors.add("max_points", "최대 방문지는 1 이상입니다.")
    if lo > hi:
        errors.add("max_points", "최대 방문지가 최소보다 크거나 같아야 합니다.")

    return lo, hi


def _parse_keyword_ids(raw: dict, errors: _Errors):
    """선호/제외 키워드 id. 같은 키워드가 양쪽에 있으면 의도를 알 수 없으므로 거절한다."""

    def read(key):
        value = raw.get(key)
        if value is None:
            return ()
        if not isinstance(value, (list, tuple, set)):
            errors.add(key, "키워드 id 배열이어야 합니다.")
            return ()
        ids = []
        for item in value:
            n = _as_int(item)
            if n is None or n <= 0:
                errors.add(key, "키워드 id 는 양의 정수여야 합니다.")
                return ()
            ids.append(n)
        return tuple(dict.fromkeys(ids))  # 순서 유지 중복 제거

    selected = read("selected_keyword_ids")
    excluded = read("excluded_keyword_ids")

    overlap = [i for i in selected if i in excluded]
    if overlap:
        errors.add(
            "excluded_keyword_ids",
            f"선호와 제외에 같은 키워드가 있습니다: {', '.join(map(str, overlap))}",
        )

    return selected, excluded


def _parse_mobility(raw: dict, errors: _Errors):
    """체력·동행. 값이 서로를 덮어쓰지 않게 각각 독립적으로 읽는다."""
    level = raw.get("mobility_level") or FIELD_BY_KEY["mobility_level"]["default"]
    if level not in MOBILITY_LEVELS:
        errors.add("mobility_level", f"{' / '.join(MOBILITY_LEVELS)} 중 하나여야 합니다.")
        level = "normal"

    size = _as_int(raw.get("party_size"))
    size = FIELD_BY_KEY["party_size"]["default"] if size is None else size
    if size < 1:
        errors.add("party_size", "인원은 1명 이상입니다.")

    return {
        "mobility_level": level,
        "party_size": size,
        "has_senior": _as_bool(raw.get("has_senior"), False),
        "has_toddler": _as_bool(raw.get("has_toddler"), False),
        "needs_barrier_free": _as_bool(raw.get("needs_barrier_free"), False),
    }


def _parse_meal(raw: dict, start_min, end_min, errors: _Errors):
    """식사. needs_meal 이 False 면 시간창 값은 검증하지 않는다(쓰이지 않으므로)."""
    needs = _as_bool(raw.get("needs_meal"), False)

    meal_start = _as_int(raw.get("meal_start_min"))
    meal_end = _as_int(raw.get("meal_end_min"))
    meal_start = DEFAULT_MEAL_START_MIN if meal_start is None else meal_start
    meal_end = DEFAULT_MEAL_END_MIN if meal_end is None else meal_end

    if not needs:
        return needs, meal_start, meal_end

    if not (0 <= meal_start <= MINUTES_IN_DAY):
        errors.add("meal_start_min", f"0~{MINUTES_IN_DAY} 분 사이여야 합니다.")
    if not (0 <= meal_end <= MINUTES_IN_DAY):
        errors.add("meal_end_min", f"0~{MINUTES_IN_DAY} 분 사이여야 합니다.")
    if meal_start >= meal_end:
        errors.add("meal_end_min", "식사 희망 종료가 시작보다 늦어야 합니다.")

    # 투어 시간과 겹치지 않으면 해가 존재할 수 없다.
    # 이것을 솔버까지 끌고 가면 사용자는 "해 없음"만 보게 되므로 여기서 잡는다.
    if start_min is not None and end_min is not None:
        if meal_end <= start_min or meal_start >= end_min:
            errors.add(
                "meal_start_min",
                "식사 희망 시간대가 투어 시간과 겹치지 않습니다.",
            )

    return needs, meal_start, meal_end


def _parse_place(raw: dict, prefix: str, errors: _Errors) -> Optional[Place]:
    """출발지/종료지. 좌표는 둘 다 있거나 둘 다 없어야 한다 — 한쪽만 있으면 버그다."""
    label = raw.get(f"{prefix}_label")
    lat = raw.get(f"{prefix}_lat")
    lng = raw.get(f"{prefix}_lng")

    lat = None if lat in (None, "") else float(lat)
    lng = None if lng in (None, "") else float(lng)

    if (lat is None) != (lng is None):
        errors.add(f"{prefix}_lat", "위도와 경도는 함께 있어야 합니다.")
        return None

    if lat is not None and not (-90 <= lat <= 90):
        errors.add(f"{prefix}_lat", "위도 범위를 벗어났습니다.")
    if lng is not None and not (-180 <= lng <= 180):
        errors.add(f"{prefix}_lng", "경도 범위를 벗어났습니다.")

    if label is None and lat is None:
        return None
    return Place(label=label, lat=lat, lng=lng)


def _parse_transport(raw: dict, errors: _Errors):
    mode = raw.get("transport_mode") or FIELD_BY_KEY["transport_mode"]["default"]
    if mode not in TRANSPORT_MODES:
        errors.add("transport_mode", f"{' / '.join(TRANSPORT_MODES)} 중 하나여야 합니다.")
        mode = "taxi"
    return mode


def parse_survey(raw: dict):
    """설문 원본(HTTP body 또는 DB row)을 SurveyV3 로 만든다.

    DB row 와 HTTP body 를 같은 함수로 받는 이유: 키 이름을 snake_case 하나로
    통일해 두면 "저장할 때 통과한 값이 읽을 때 실패"하는 종류의 버그가 사라진다.
    JS 쪽 camelCase 는 경계(controller.js)에서 변환한다.

    Returns:
        (survey, errors) — errors 가 비어 있지 않으면 survey 는 None.
    """
    raw = raw or {}
    errors = _Errors()

    start_min, end_min = _parse_time_window(raw, errors)
    min_points, max_points = _parse_point_count(raw, errors)
    selected, excluded = _parse_keyword_ids(raw, errors)
    mobility = _parse_mobility(raw, errors)
    needs_meal, meal_start, meal_end = _parse_meal(raw, start_min, end_min, errors)
    transport_mode = _parse_transport(raw, errors)

    origin = _parse_place(raw, "origin", errors)
    return_to_origin = _as_bool(raw.get("return_to_origin"), True)
    destination = origin if return_to_origin else _parse_place(raw, "destination", errors)

    budget = _as_int(raw.get("budget"))
    if budget is None:
        budget = 0
    elif budget < 0:
        errors.add("budget", "예산은 0 이상의 정수여야 합니다.")

    if errors:
        return None, errors.items

    survey = SurveyV3(
        start_min=start_min,
        end_min=end_min,
        min_points=min_points,
        max_points=max_points,
        selected_keyword_ids=selected,
        excluded_keyword_ids=excluded,
        needs_meal=needs_meal,
        meal_start_min=meal_start,
        meal_end_min=meal_end,
        transport_mode=transport_mode,
        origin=origin,
        destination=destination,
        budget=budget,
        survey_id=_as_int(raw.get("id")) or _as_int(raw.get("survey_id")),
        region_id=_as_int(raw.get("region_id")),
        **mobility,
    )
    return survey, []


# ── 사전 경고 ────────────────────────────────────────────────────
# 검증을 통과했지만 "이대로면 결과가 사용자 기대와 다를" 입력들.
# 거절하지 않고 경고만 남긴다 — 판단은 사용자/관리자의 몫이다.


def warnings_for(survey: SurveyV3):
    out = []

    if not survey.selected_keyword_ids:
        out.append(
            "선호 키워드가 없습니다 — 코스가 선호와 무관하게 이동시간만으로 결정됩니다."
        )

    if survey.needs_barrier_free:
        out.append(
            "무장애 접근을 요청했지만 POI 접근성 데이터가 없어 필터링하지 못했습니다. "
            "현장 확인이 필요합니다."
        )

    if survey.origin is None or not survey.origin.has_coords:
        out.append(
            "출발지 좌표가 없어 첫 구간 이동시간을 0으로 계산합니다 — "
            "실제 일정은 여기서 나온 것보다 늦어집니다."
        )

    if survey.budget > 0:
        out.append(
            "예산은 저장만 되고 코스 선정에는 반영되지 않습니다 (POI 가격 데이터 없음)."
        )

    return out
