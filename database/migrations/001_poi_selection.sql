-- 거점 선정 파이프라인 산출물 저장
--
-- ── 왜 별도 테이블인가 ──────────────────────────────────────────
-- 기존 `points` 는 "확정된 운영 거점"이고, 여기 저장하는 것은
-- "후보 + 그렇게 판단한 근거" 다. 성격이 달라 한 테이블에 담을 수 없다.
--
-- `points` 스키마와 구조적으로 충돌하는 것들:
--   · points.guide_id 가 NOT NULL — 가이드 배치는 파이프라인 밖 별도 단계다
--   · points.open_min/close_min 이 NOT NULL — 운영시간 unknown 을 표현할 수 없어
--     저장할 때마다 09-18 폴백(근거 없어 제거한 값)이 되살아난다
--   · points 에 좌표 컬럼이 없다 — 파이프라인이 계산한 좌표가 소실된다
--   · points 에 content_id 가 없다 — 멱등성이 이름 기준이라 재수집 시 매칭이 깨진다
--
-- ── 병합 충돌 회피 ──────────────────────────────────────────────
-- 기존 테이블(regions/guides/points/keywords)을 **변경하지 않고 FK 도 걸지 않는다.**
-- feature/db-setup, feature/poi-commit 과 나란히 존재할 수 있어야 한다.
-- 지역 참조는 regions.id 가 아니라 area_code/sigungu_code 자연키로 한다.
-- 나중에 확정 거점을 points 로 승격할 때 그 매핑만 만들면 된다.

USE halmae_tour;

-- ── 실행 단위 ────────────────────────────────────────────────────
-- 파이프라인 1회 실행 = 1행. **이 결과가 실측인지 mock 인지가 여기 남는다.**
-- 이 값 없이 후보만 보면 가짜 데이터를 실측으로 오인하게 된다.
CREATE TABLE IF NOT EXISTS poi_selection_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  area_code VARCHAR(10) NOT NULL,
  sigungu_code VARCHAR(10) NOT NULL,
  sigungu_name VARCHAR(100) NOT NULL,

  -- 데이터 출처. mock 이면 이 실행의 결과는 실측이 아니다.
  source_mode ENUM('live', 'mock') NOT NULL,
  source_mode_reason VARCHAR(200),
  -- 카테고리 수요 가중의 출처. mock 이면 수요값에 근거가 없다.
  survey_source ENUM('survey', 'mock') NOT NULL,

  -- 이 실행에 쓰인 정책값
  region_threshold_min SMALLINT UNSIGNED NOT NULL,
  min_separation_min SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  conditions JSON,
  api_calls JSON,
  -- STEP 6 분포 관측치. 나중에 기준을 바꿀 때 근거가 된다.
  travel_distribution JSON,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_poi_selection_runs_region (area_code, sigungu_code, created_at)
);

-- ── 후보 POI ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poi_candidates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id BIGINT UNSIGNED NOT NULL,

  -- TourAPI 원본 식별자. 재수집 시 이름이 아니라 이걸로 매칭한다.
  content_id VARCHAR(30) NOT NULL,
  content_type_id SMALLINT UNSIGNED,
  title VARCHAR(200) NOT NULL,

  -- 좌표는 반드시 보존한다. 이동시간 재계산과 CP-SAT 에 필요하다.
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),

  address VARCHAR(300),
  tel VARCHAR(100),
  image_url VARCHAR(500),
  description TEXT,

  -- 분류체계 두 벌 모두 보존 — 매핑 규칙을 바꿔도 재적용할 수 있어야 한다
  cat1 VARCHAR(10), cat2 VARCHAR(10), cat3 VARCHAR(20),
  lcls_systm1 VARCHAR(10), lcls_systm2 VARCHAR(10), lcls_systm3 VARCHAR(20),

  -- 관광 선호는 단일 카테고리. 운영 조건과 섞지 않는다.
  preference_category VARCHAR(30),
  mapping_status ENUM('mapped', 'unmapped', 'no_code'),
  classification_source ENUM('lclsSystm3', 'cat3'),
  classification_code VARCHAR(20),

  poi_role ENUM('GUIDE_HUB', 'ROUTE_STOP'),

  duration_min SMALLINT UNSIGNED,
  -- 다중 구간 그대로 보존. 스칼라 축약 정책이 미결이라 원형을 유지한다.
  -- NULL 은 "못 읽음" 이며 폴백을 넣지 않는다.
  open_windows JSON,
  rest_days JSON,

  viability_status ENUM('valid', 'needs_review', 'unavailable'),
  viability_reasons JSON,

  accessibility JSON,

  -- 각 값이 어디서 왔는지. policy/default 비중이 곧 데이터 품질 지표다.
  sources JSON,

  -- STEP 6 권역 번호. 권역에 안 들어가면 NULL.
  cluster_rank SMALLINT UNSIGNED,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_poi_candidates_run_content (run_id, content_id),
  KEY idx_poi_candidates_cluster (run_id, cluster_rank),
  CONSTRAINT fk_poi_candidates_run
    FOREIGN KEY (run_id) REFERENCES poi_selection_runs(id) ON DELETE CASCADE
);

-- ── STEP 7 후보 조합 ─────────────────────────────────────────────
-- 하나로 확정하지 않는다. 4개·5개를 따로 담고 최종 선택은 운영 정책의 몫이다.
CREATE TABLE IF NOT EXISTS poi_hub_combinations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id BIGINT UNSIGNED NOT NULL,

  cluster_rank SMALLINT UNSIGNED NOT NULL,
  candidate_size TINYINT UNSIGNED NOT NULL,

  -- Pareto 축 1: 수요 커버리지
  category_coverage TINYINT UNSIGNED NOT NULL,
  demand_covered DECIMAL(6, 4),
  category_distribution JSON,

  -- Pareto 축 2: 이동 효율
  max_pair_travel_min SMALLINT UNSIGNED,
  min_pair_travel_min SMALLINT UNSIGNED,
  mean_pair_travel_min SMALLINT UNSIGNED,
  median_pair_travel_min SMALLINT UNSIGNED,

  travel_provider_distribution JSON,
  kakao_route_ratio DECIMAL(4, 2),

  -- 선정 점수가 아니다. needs_review 판단에만 쓴다.
  data_quality JSON,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_reasons JSON,

  pareto_point JSON,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_poi_hub_combinations_run (run_id, cluster_rank, candidate_size),
  CONSTRAINT fk_poi_hub_combinations_run
    FOREIGN KEY (run_id) REFERENCES poi_selection_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poi_hub_combination_members (
  combination_id BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (combination_id, candidate_id),
  CONSTRAINT fk_hub_members_combination
    FOREIGN KEY (combination_id) REFERENCES poi_hub_combinations(id) ON DELETE CASCADE,
  CONSTRAINT fk_hub_members_candidate
    FOREIGN KEY (candidate_id) REFERENCES poi_candidates(id) ON DELETE CASCADE
);
