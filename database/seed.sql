USE halmae_tour;

INSERT INTO users (id, email, password_hash, name)
VALUES
  (1, 'sample@halmae-tour.test', 'sample-password-hash', '샘플 사용자')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  name = VALUES(name);

INSERT INTO regions (id, name, description, image_url)
VALUES
  (1, '경북 청송', '주왕산, 주산지, 고택과 지역 체험을 중심으로 한 할매투어 샘플 지역', NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  image_url = VALUES(image_url);

INSERT INTO guides (id, region_id, name, intro, profile_image_url)
VALUES
  (1, 1, '김영자 가이드', '주왕산 산책길과 쉬운 자연 코스를 안내하는 가이드', NULL),
  (2, 1, '박순희 가이드', '주산지 풍경과 사진 명소를 차분히 안내하는 가이드', NULL),
  (3, 1, '이정숙 가이드', '송소고택과 청송 고택 문화를 설명하는 가이드', NULL),
  (4, 1, '최말자 가이드', '청송백자와 지역 공예 체험을 잘 아는 가이드', NULL),
  (5, 1, '정옥분 가이드', '청송사과와 지역 먹거리 체험에 익숙한 가이드', NULL),
  (6, 1, '한미자 가이드', '청송 얼음골과 계절 자연 명소를 안내하는 가이드', NULL),
  (7, 1, '오복순 가이드', '객주문학관과 조용한 실내 관람 코스에 강한 가이드', NULL)
ON DUPLICATE KEY UPDATE
  region_id = VALUES(region_id),
  name = VALUES(name),
  intro = VALUES(intro),
  profile_image_url = VALUES(profile_image_url);

-- preference 어휘는 설문v1(집단 사전 설문)의 5종과 같아야 한다.
-- keywordMapper.PREFERENCE_CATEGORIES 와 문자열까지 일치시킨다 —
-- v1 이 판정한 preference_category 를 변환표 없이 그대로 쓸 수 있어야 하기 때문이다.
-- environment 는 관광 선호가 아니라 운영 조건 축이라 v1 과 무관하게 유지한다.
-- (id 4 는 옛 '사진명소' 자리다. v1 이 의도적으로 제외한 축이라 비워 둔다 —
--  migrations/002_survey_v2_vocabulary.sql 참조)
INSERT INTO keywords (id, name, type)
VALUES
  (1, '역사·문화', 'preference'),
  (2, '시장·지역생활', 'preference'),
  (3, '자연', 'preference'),
  (5, '음식', 'preference'),
  (6, '체험', 'preference'),
  (7, '조용함', 'environment'),
  (8, '실내', 'environment')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  type = VALUES(type);

INSERT INTO points (
  id,
  region_id,
  guide_id,
  name,
  description,
  image_url,
  duration_min,
  open_min,
  close_min,
  reservation_required,
  is_active
)
VALUES
  (1, 1, 1, '주왕산국립공원', '청송 대표 자연 명소를 걷는 샘플 포인트', NULL, 90, 540, 1080, FALSE, TRUE),
  (2, 1, 2, '주산지', '물안개와 왕버들 풍경을 보는 샘플 포인트', NULL, 60, 540, 1080, FALSE, TRUE),
  (3, 1, 3, '송소고택', '청송의 고택 문화를 느끼는 샘플 포인트', NULL, 70, 540, 1020, FALSE, TRUE),
  (4, 1, 4, '청송백자전수관', '청송백자와 공예 체험을 연결한 샘플 포인트', NULL, 60, 600, 1020, TRUE, TRUE),
  (5, 1, 5, '청송사과테마파크', '청송사과와 지역 먹거리 체험을 위한 샘플 포인트', NULL, 50, 540, 1080, FALSE, TRUE),
  (6, 1, 6, '청송 얼음골', '계절 자연 경관과 시원한 계곡을 보는 샘플 포인트', NULL, 55, 540, 1080, FALSE, TRUE),
  (7, 1, 7, '객주문학관', '문학과 지역 이야기를 조용히 관람하는 샘플 포인트', NULL, 55, 600, 1020, FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  region_id = VALUES(region_id),
  guide_id = VALUES(guide_id),
  name = VALUES(name),
  description = VALUES(description),
  image_url = VALUES(image_url),
  duration_min = VALUES(duration_min),
  open_min = VALUES(open_min),
  close_min = VALUES(close_min),
  reservation_required = VALUES(reservation_required),
  is_active = VALUES(is_active);

DELETE FROM point_keywords
WHERE point_id BETWEEN 1 AND 7;

-- preference 는 POI 하나당 주 카테고리 하나만 붙인다(v1 설계원칙 2).
-- environment 는 별개 축이라 복수로 붙어도 된다.
INSERT INTO point_keywords (point_id, keyword_id)
VALUES
  (1, 3),                    -- 주왕산국립공원   자연
  (2, 3), (2, 7),            -- 주산지           자연 + 조용함
  (3, 1), (3, 7),            -- 송소고택         역사·문화 + 조용함
  (4, 6), (4, 8),            -- 청송백자전수관   체험 + 실내
  (5, 5),                    -- 청송사과테마파크 음식
  (6, 3),                    -- 청송 얼음골      자연
  (7, 1), (7, 8), (7, 7);    -- 객주문학관       역사·문화 + 실내 + 조용함

INSERT INTO preference_surveys (
  id,
  user_id,
  region_id,
  budget,
  start_min,
  end_min,
  min_points,
  max_points
)
VALUES
  (1, 1, 1, 100000, 540, 1080, 2, 4)
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  region_id = VALUES(region_id),
  budget = VALUES(budget),
  start_min = VALUES(start_min),
  end_min = VALUES(end_min),
  min_points = VALUES(min_points),
  max_points = VALUES(max_points);

DELETE FROM survey_keywords
WHERE survey_id = 1;

INSERT INTO survey_keywords (survey_id, keyword_id, usage_type)
VALUES
  (1, 1, 'selected'),   -- 역사·문화
  (1, 3, 'selected'),   -- 자연
  (1, 5, 'selected');   -- 음식

INSERT INTO travel_time_cache (
  from_point_id,
  to_point_id,
  transport_mode,
  travel_min,
  provider
)
VALUES
  (1, 2, 'taxi', 15, 'sample'), (1, 3, 'taxi', 25, 'sample'), (1, 4, 'taxi', 12, 'sample'), (1, 5, 'taxi', 18, 'sample'), (1, 6, 'taxi', 10, 'sample'), (1, 7, 'taxi', 14, 'sample'),
  (2, 1, 'taxi', 15, 'sample'), (2, 3, 'taxi', 20, 'sample'), (2, 4, 'taxi', 8, 'sample'), (2, 5, 'taxi', 10, 'sample'), (2, 6, 'taxi', 12, 'sample'), (2, 7, 'taxi', 9, 'sample'),
  (3, 1, 'taxi', 25, 'sample'), (3, 2, 'taxi', 20, 'sample'), (3, 4, 'taxi', 22, 'sample'), (3, 5, 'taxi', 16, 'sample'), (3, 6, 'taxi', 24, 'sample'), (3, 7, 'taxi', 21, 'sample'),
  (4, 1, 'taxi', 12, 'sample'), (4, 2, 'taxi', 8, 'sample'), (4, 3, 'taxi', 22, 'sample'), (4, 5, 'taxi', 11, 'sample'), (4, 6, 'taxi', 13, 'sample'), (4, 7, 'taxi', 6, 'sample'),
  (5, 1, 'taxi', 18, 'sample'), (5, 2, 'taxi', 10, 'sample'), (5, 3, 'taxi', 16, 'sample'), (5, 4, 'taxi', 11, 'sample'), (5, 6, 'taxi', 15, 'sample'), (5, 7, 'taxi', 12, 'sample'),
  (6, 1, 'taxi', 10, 'sample'), (6, 2, 'taxi', 12, 'sample'), (6, 3, 'taxi', 24, 'sample'), (6, 4, 'taxi', 13, 'sample'), (6, 5, 'taxi', 15, 'sample'), (6, 7, 'taxi', 9, 'sample'),
  (7, 1, 'taxi', 14, 'sample'), (7, 2, 'taxi', 9, 'sample'), (7, 3, 'taxi', 21, 'sample'), (7, 4, 'taxi', 6, 'sample'), (7, 5, 'taxi', 12, 'sample'), (7, 6, 'taxi', 9, 'sample')
ON DUPLICATE KEY UPDATE
  travel_min = VALUES(travel_min),
  provider = VALUES(provider);
