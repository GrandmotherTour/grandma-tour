-- 거점 승격 — 설문v1 산출물(poi_candidates)을 설문v2 입력(points)으로 넘기기 위한 스키마
--
-- ── 무엇을 푸는가 ────────────────────────────────────────────────
-- 두 흐름이 서로 다른 키를 쓰고 있어 이을 수 없었다.
--   설문v1  area_code/sigungu_code(35/21) + TourAPI content_id
--   설문v2  regions.id + points.id
-- 001 마이그레이션 헤더가 적어 둔 승격 불가 사유 4개 중 3개를 여기서 없앤다.
--
-- ── 하지 않는 것 ─────────────────────────────────────────────────
-- 기존 데이터를 지우거나 옮기지 않는다. 컬럼만 열고, 값은 승격 서비스가 넣는다.
-- points.guide_id 는 NOT NULL 그대로 둔다 — 플레이스홀더 가이드를 만들기로 했다.
--
-- ── 멱등성 ───────────────────────────────────────────────────────
-- MySQL 8 은 ADD COLUMN IF NOT EXISTS 를 지원하지 않는다.
-- information_schema 를 보고 필요한 경우에만 실행한다. 두 번 돌려도 안전하다.

USE halmae_tour;

-- ── 1. regions: 설문v1 의 지역 자연키 ────────────────────────────
-- 지금은 id + name('경북 청송') 뿐이라 v1 의 35/21(청송군)과 대응할 방법이 없다.
-- 이름 매칭은 쓰지 않는다 — v1 은 '청송군', v2 시드는 '경북 청송' 이다.
SET @has_area_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regions' AND COLUMN_NAME = 'area_code'
);
SET @sql := IF(@has_area_code = 0,
  'ALTER TABLE regions
     ADD COLUMN area_code VARCHAR(10) NULL AFTER name,
     ADD COLUMN sigungu_code VARCHAR(10) NULL AFTER area_code',
  'SELECT "regions.area_code 이미 있음" AS skipped');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 승격 멱등성의 기준. NULL 이 여럿이어도 UNIQUE 에 걸리지 않으므로
-- 코드를 아직 안 붙인 기존 지역들과 공존한다.
SET @has_area_key := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regions' AND INDEX_NAME = 'uk_regions_area'
);
SET @sql := IF(@has_area_key = 0,
  'ALTER TABLE regions ADD UNIQUE KEY uk_regions_area (area_code, sigungu_code)',
  'SELECT "uk_regions_area 이미 있음" AS skipped');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 시드 지역에 코드를 붙인다. 경북(35) 청송군(21).
-- sigunguCode 19 는 의성군이다 — 2026-08-13 areaCode2 로 확인한 값이다.
UPDATE regions
   SET area_code = '35', sigungu_code = '21'
 WHERE name = '경북 청송' AND area_code IS NULL;

-- ── 2. points: POI 정체성과 좌표 ─────────────────────────────────
-- content_id 가 없으면 재승격이 이름 기준이 되어 재수집 때 매칭이 깨진다(001 헤더).
-- 좌표가 없으면 파이프라인이 계산한 값이 소실되고 이동시간 재계산도 못 한다.
SET @has_content_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'points' AND COLUMN_NAME = 'content_id'
);
SET @sql := IF(@has_content_id = 0,
  'ALTER TABLE points
     ADD COLUMN content_id VARCHAR(30) NULL AFTER name,
     ADD COLUMN latitude DECIMAL(10, 7) NULL AFTER description,
     ADD COLUMN longitude DECIMAL(10, 7) NULL AFTER latitude',
  'SELECT "points.content_id 이미 있음" AS skipped');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_content_key := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'points'
     AND INDEX_NAME = 'uk_points_region_content'
);
SET @sql := IF(@has_content_key = 0,
  'ALTER TABLE points ADD UNIQUE KEY uk_points_region_content (region_id, content_id)',
  'SELECT "uk_points_region_content 이미 있음" AS skipped');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 3. 운영시간을 "모른다"고 말할 수 있게 한다 ───────────────────
-- NOT NULL 이면 승격할 때마다 09:00~18:00 폴백을 넣어야 하는데,
-- 그 값은 근거가 없어 파이프라인 재작성 때 의도적으로 제거한 것이다.
-- 실제로 TourAPI usetime 은 자유 텍스트라 상당수가 파싱되지 않는다.
--
-- ⚠ 운영시간 정책 자체는 아직 미결이다. 다른 API 를 확보한 뒤 정한다.
--    지금은 "못 읽었으면 NULL" 만 지키고, NULL 인 거점을 루트 생성에서
--    어떻게 다룰지는 recommender.py 의 임시 처리에 맡긴다.
ALTER TABLE points
  MODIFY COLUMN open_min SMALLINT UNSIGNED NULL,
  MODIFY COLUMN close_min SMALLINT UNSIGNED NULL;
