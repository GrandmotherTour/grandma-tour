-- 설문v2(개인 설문) 키워드 어휘를 설문v1(집단 사전 설문) 카테고리에 정합시킨다
--
-- ── 왜 필요한가 ──────────────────────────────────────────────────
-- 두 설문이 서로 다른 어휘를 쓰고 있었다.
--   설문v1  자연 / 역사·문화 / 시장·지역생활 / 음식 / 체험   (keywordMapper.PREFERENCE_CATEGORIES)
--   설문v2  역사 / 전통시장 / 자연산책 / 사진명소 / 음식 / 체험 (keywords 시드)
--
-- 어휘가 다르면 v1 이 판정한 POI 의 preference_category 를 v2 의 point_keywords 로
-- 그대로 승격할 수 없고, 중간에 근거 없는 변환표가 하나 더 생긴다.
-- docs/keyword-mapping-facts.md §112 가 이미 지적한 항목이다:
--   "키워드 어휘는 사용자 설문 문항과 같은 어휘여야 한다. POI 쪽만 정할 수 없다."
--
-- ── 무엇을 바꾸는가 ──────────────────────────────────────────────
-- preference 타입 키워드만 v1 5종으로 맞춘다.
-- environment(조용함·실내)는 그대로 둔다 — 관광 선호가 아니라 운영 조건 축이고,
-- v1 도 이 둘을 preference_category 에 섞지 않는다(keywordMapper §설계원칙 1).
--
-- ── 사진명소를 지우는 이유 ───────────────────────────────────────
-- v1 이 의도적으로 어휘에서 제외한 축이다. 분류코드에서 유도되지 않아
-- POI 쪽에 대응이 없다(keywordMapper.js §D-1). v2 에만 남겨두면
-- 사용자가 선택해도 매칭될 POI 가 구조적으로 없는 문항이 된다.
--
-- ── 적용 대상 ────────────────────────────────────────────────────
-- 이미 seed.sql 이 적용된 DB 를 고친다. 신규 DB 는 갱신된 seed.sql 이
-- 처음부터 새 어휘로 넣으므로 이 스크립트는 0행에 영향을 준다(안전).

USE halmae_tour;

-- ── 1. preference 키워드를 v1 어휘로 교체 ────────────────────────
-- id 를 유지한 채 이름만 바꾼다. point_keywords / survey_keywords 의 FK 가
-- 살아 있어야 기존 설문 응답이 깨지지 않는다.
UPDATE keywords SET name = '역사·문화'     WHERE id = 1 AND name = '역사';
UPDATE keywords SET name = '시장·지역생활' WHERE id = 2 AND name = '전통시장';
UPDATE keywords SET name = '자연'          WHERE id = 3 AND name = '자연산책';
-- id 5 음식, id 6 체험 은 이름이 이미 v1 과 같다.

-- ── 2. 사진명소(id 4) 제거 ───────────────────────────────────────
-- 참조부터 지운다. FK 순서를 지키지 않으면 실패한다.
DELETE FROM survey_keywords WHERE keyword_id = 4;
DELETE FROM point_keywords  WHERE keyword_id = 4;
DELETE FROM keywords        WHERE id = 4 AND name = '사진명소';

-- ── 3. 샘플 포인트 재매핑 ────────────────────────────────────────
-- v1 원칙과 맞춘다: preference 는 POI 하나당 **주 카테고리 하나만**.
-- 겹쳐 붙이면 그 POI 의 매칭 점수가 부당하게 높아진다(keywordMapper §설계원칙 2).
-- environment 는 별개 축이라 복수로 붙어도 된다.
--
-- 대상은 seed.sql 이 넣은 청송 샘플 7건이다.
DELETE FROM point_keywords WHERE point_id BETWEEN 1 AND 7;

INSERT INTO point_keywords (point_id, keyword_id)
VALUES
  -- 주왕산국립공원      자연
  (1, 3),
  -- 주산지              자연 + 조용함
  (2, 3), (2, 7),
  -- 송소고택            역사·문화 + 조용함
  (3, 1), (3, 7),
  -- 청송백자전수관      체험 + 실내
  (4, 6), (4, 8),
  -- 청송사과테마파크    음식
  (5, 5),
  -- 청송 얼음골         자연
  (6, 3),
  -- 객주문학관          역사·문화 + 실내 + 조용함
  (7, 1), (7, 8), (7, 7);
