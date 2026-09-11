-- 설문v2 에 "코스 생성에 실제로 쓰이는" 맥락 항목을 추가한다 (설문v3)
--
-- ── 왜 필요한가 ──────────────────────────────────────────────────
-- 현재 recommender.py 가 설문에서 읽는 값은 6개뿐이다.
--   start_min / end_min / min_points / max_points / selected / excluded
-- budget 은 저장만 하고 아무 데도 쓰이지 않는다.
--
-- 그 결과 CP-SAT 이 만드는 코스는 "누가 가는지"를 전혀 모른다.
-- 80대 어르신 2인과 20대 1인에게 같은 코스가 나온다. 이동시간도
-- transport_mode='taxi' 로 서비스 코드에 하드코딩돼 있어(service.js:10)
-- 사용자가 도보인지 자차인지와 무관하다.
--
-- ── 무엇을 추가하는가 ────────────────────────────────────────────
-- 세 묶음이다. 각각이 CP-SAT 의 어느 부분을 바꾸는지 주석에 적는다.
--   1) 체력·동행   → 이동 상한 / POI 간 버퍼 / 후보 필터
--   2) 식사        → "음식 POI 를 특정 시간창에 배치" 하드 제약
--   3) 이동·기점   → travel_time_cache 조회 모드 + 출발/도착 구간 시간
--
-- ── 추가하지 않는 것 ─────────────────────────────────────────────
-- budget 은 이번에도 쓰지 않는다. points 에 가격 컬럼이 없어
-- sum(price) <= budget 을 쓸 수 없고, 없는 가격을 추정해 넣으면
-- "근거 없는 임의값" 을 하나 더 만드는 것뿐이다.
-- 컬럼은 그대로 두고, 미사용이라는 사실을 코드 주석에 남긴다.
--
-- ── 기본값 정책 ──────────────────────────────────────────────────
-- 모든 신규 컬럼은 NOT NULL DEFAULT 또는 NULL 허용이다.
-- 기존 행(설문v2 응답)이 있어도 마이그레이션이 실패하지 않아야 하고,
-- 기본값으로 돌렸을 때 결과가 지금과 같아야 한다(회귀 없음).

USE halmae_tour;

-- ── 1. 체력 · 동행 구성 ──────────────────────────────────────────

ALTER TABLE preference_surveys
  -- 보행/체력 수준. 'normal' 이 기존 동작과 동일한 중립값이다.
  --   low    : 한 구간 이동 상한을 줄이고 POI 사이에 휴식 버퍼를 넣는다
  --   normal : 버퍼 없음 (= 설문v2 와 동일한 결과)
  --   high   : 이동 상한을 늘려 더 먼 POI 까지 후보에 남긴다
  -- ⚠ 각 수준에 대응하는 분(minute) 값은 solver_inputs.py 의 임의값이다.
  ADD COLUMN mobility_level ENUM('low', 'normal', 'high')
    NOT NULL DEFAULT 'normal' AFTER max_points,

  -- 인원 수. 현재 CP-SAT 제약으로는 쓰지 않는다(정원 데이터가 없음).
  -- 예약/가격 산정과 로그 분석용으로만 저장한다.
  ADD COLUMN party_size TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER mobility_level,

  -- 동행 구성. mobility_level 과 별개 축이다 —
  -- "어르신 동반"이 곧 "저체력"은 아니고, 필요한 편의시설이 다르다.
  ADD COLUMN has_senior  BOOLEAN NOT NULL DEFAULT FALSE AFTER party_size,
  ADD COLUMN has_toddler BOOLEAN NOT NULL DEFAULT FALSE AFTER has_senior,

  -- 휠체어/유아차 접근이 필요한가.
  -- ⚠ 이 값을 후보 필터로 쓰려면 points 쪽에 접근성 컬럼이 있어야 하는데
  --   지금은 없다(init.sql). 그래서 이 컬럼은 당분간 **필터로 동작하지 않고**,
  --   solver_inputs.py 가 trace 에 "요구했으나 판정 불가" 경고를 남긴다.
  --   points 접근성 컬럼은 별도 마이그레이션(004)의 몫이다.
  ADD COLUMN needs_barrier_free BOOLEAN NOT NULL DEFAULT FALSE AFTER has_toddler;

-- ── 2. 식사 ──────────────────────────────────────────────────────

ALTER TABLE preference_surveys
  -- TRUE 면 CP-SAT 이 '음식' 키워드 POI 를 최소 1곳 **반드시** 포함시키고
  -- 그 방문 시작 시각을 아래 시간창 안으로 강제한다.
  -- FALSE 면 음식 POI 도 다른 POI 와 동등하게 취급된다(현행과 동일).
  ADD COLUMN needs_meal BOOLEAN NOT NULL DEFAULT FALSE AFTER needs_barrier_free,

  -- 희망 식사 시간대(분). NULL 이면 solver_inputs.py 의 기본 창(11:30~13:30)을 쓴다.
  -- 기본 창 역시 임의값이며, 한국 점심시간 통념일 뿐 근거 데이터는 없다.
  ADD COLUMN meal_start_min SMALLINT UNSIGNED NULL AFTER needs_meal,
  ADD COLUMN meal_end_min   SMALLINT UNSIGNED NULL AFTER meal_start_min;

-- ── 3. 이동수단 · 출발/종료 지점 ─────────────────────────────────

ALTER TABLE preference_surveys
  -- travel_time_cache.transport_mode 와 **같은 ENUM 이어야 한다.**
  -- 지금은 service.js 가 "taxi" 를 하드코딩하고 있어 설문과 무관하게 조회된다.
  -- 기본값을 'taxi' 로 두어 기존 동작을 유지한다.
  ADD COLUMN transport_mode ENUM('walking', 'car', 'taxi', 'public_transit')
    NOT NULL DEFAULT 'taxi' AFTER meal_end_min,

  -- 출발지. 좌표가 있으면 "출발지 → 첫 POI" 구간 이동시간을 예산에 반영한다.
  -- NULL 이면 그 구간을 0 으로 두는데, 이는 **실제보다 낙관적인 일정**이 된다.
  -- 그 사실을 trace 에 남긴다(solver_inputs.build_anchor).
  ADD COLUMN origin_label VARCHAR(150) NULL AFTER transport_mode,
  ADD COLUMN origin_lat   DECIMAL(10, 7) NULL AFTER origin_label,
  ADD COLUMN origin_lng   DECIMAL(10, 7) NULL AFTER origin_lat,

  -- 종료 지점. return_to_origin=TRUE 면 출발지와 같다고 본다.
  -- FALSE 이고 아래 좌표가 있으면 "마지막 POI → 종료지" 구간을 예산에 반영한다.
  ADD COLUMN return_to_origin  BOOLEAN NOT NULL DEFAULT TRUE AFTER origin_lng,
  ADD COLUMN destination_label VARCHAR(150) NULL AFTER return_to_origin,
  ADD COLUMN destination_lat   DECIMAL(10, 7) NULL AFTER destination_label,
  ADD COLUMN destination_lng   DECIMAL(10, 7) NULL AFTER destination_lat;

-- ── 4. 정합성 확인용 ─────────────────────────────────────────────
-- CHECK 제약은 MySQL 8.0.16+ 에서만 실제로 강제된다.
-- 애플리케이션(survey_spec.py / controller.js)에서도 같은 규칙을 검증하므로
-- 여기서는 이중 안전장치다.
ALTER TABLE preference_surveys
  ADD CONSTRAINT ck_surveys_meal_window
    CHECK (
      meal_start_min IS NULL
      OR meal_end_min IS NULL
      OR meal_start_min < meal_end_min
    ),
  ADD CONSTRAINT ck_surveys_party_size
    CHECK (party_size >= 1);
