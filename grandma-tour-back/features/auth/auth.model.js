// 서비스 로직용 SQL 쿼리 모음

const sqlQueries = {
  // 1. 회원가입
  signup: `
    INSERT INTO users (email, password_hash, name)
    VALUES (?, ?, ?)
  `,

  // 2. 로그인용 사용자 조회
  getUserByEmail: `
    SELECT
      id,
      email,
      password_hash,
      name
    FROM users
    WHERE email = ?
  `,

  // 3. 지역 목록 조회
  getRegions: `
    SELECT
      r.id,
      r.name,
      r.description,
      r.image_url,
      g.id AS guide_id,
      g.name AS guide_name,
      g.intro AS guide_intro,
      g.profile_image_url AS guide_profile_image_url
    FROM regions r
    LEFT JOIN guides g ON g.region_id = r.id
    ORDER BY r.id
  `,

  // 4. 특정 지역 상세 조회
  getRegionById: `
    SELECT
      r.id,
      r.name,
      r.description,
      r.image_url,
      g.id AS guide_id,
      g.name AS guide_name,
      g.intro AS guide_intro,
      g.profile_image_url AS guide_profile_image_url
    FROM regions r
    LEFT JOIN guides g ON g.region_id = r.id
    WHERE r.id = ?
  `,

  // 5. 선호도 선택용 키워드 목록 조회
  getKeywords: `
    SELECT
      id,
      name,
      type
    FROM keywords
    ORDER BY
      CASE type
        WHEN 'preference' THEN 1
        WHEN 'environment' THEN 2
        WHEN 'constraint' THEN 3
      END,
      id
  `,

  // 6. 선호도 설문 저장
  createPreferenceSurvey: `
    INSERT INTO preference_surveys (
      user_id,
      region_id,
      budget,
      start_min,
      end_min,
      min_points,
      max_points
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  // 7. 방금 저장한 설문 ID 조회
  getLastInsertIdAsSurveyId: `
    SELECT LAST_INSERT_ID() AS survey_id
  `,

  // 8. 설문 선택/제외 키워드 저장
  createSurveyKeyword: `
    INSERT INTO survey_keywords (
      survey_id,
      keyword_id,
      usage_type
    )
    VALUES (?, ?, ?)
  `,

  // 9. 추천 알고리즘 입력용 설문 정보 조회
  getSurveyForRecommendation: `
    SELECT
      ps.id AS survey_id,
      ps.user_id,
      ps.region_id,
      ps.budget,
      ps.start_min,
      ps.end_min,
      ps.min_points,
      ps.max_points
    FROM preference_surveys ps
    WHERE ps.id = ?
  `,

  // 10. 추천 알고리즘 입력용 선택 키워드 조회
  getSelectedKeywordsBySurveyId: `
    SELECT
      k.id,
      k.name,
      k.type
    FROM survey_keywords sk
    JOIN keywords k ON k.id = sk.keyword_id
    WHERE sk.survey_id = ?
      AND sk.usage_type = 'selected'
  `,

  // 11. 추천 알고리즘 입력용 제외 키워드 조회
  getExcludedKeywordsBySurveyId: `
    SELECT
      k.id,
      k.name,
      k.type
    FROM survey_keywords sk
    JOIN keywords k ON k.id = sk.keyword_id
    WHERE sk.survey_id = ?
      AND sk.usage_type = 'excluded'
  `,

  // 12. 추천 후보 포인트 조회
  getCandidatePointsBySurveyId: `
    SELECT
      p.id,
      p.region_id,
      p.guide_id,
      p.name,
      p.description,
      p.image_url,
      p.duration_min,
      p.open_min,
      p.close_min,
      p.reservation_required
    FROM points p
    JOIN preference_surveys ps ON ps.region_id = p.region_id
    WHERE ps.id = ?
      AND p.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM point_keywords pk
        JOIN survey_keywords sk
          ON sk.keyword_id = pk.keyword_id
        WHERE pk.point_id = p.id
          AND sk.survey_id = ps.id
          AND sk.usage_type = 'excluded'
      )
    ORDER BY p.id
  `,

  // 13. 추천 후보 포인트별 키워드 조회
  getCandidatePointKeywordsBySurveyId: `
    SELECT
      p.id AS point_id,
      k.id AS keyword_id,
      k.name AS keyword_name,
      k.type AS keyword_type
    FROM points p
    JOIN preference_surveys ps ON ps.region_id = p.region_id
    JOIN point_keywords pk ON pk.point_id = p.id
    JOIN keywords k ON k.id = pk.keyword_id
    WHERE ps.id = ?
      AND p.is_active = TRUE
    ORDER BY p.id, k.id
  `,

  // 14. 이동시간 캐시 조회
  getTravelTimeCacheByRegionId: `
    SELECT
      t.from_point_id,
      t.to_point_id,
      t.transport_mode,
      t.travel_min,
      t.provider,
      t.calculated_at
    FROM travel_time_cache t
    JOIN points p1 ON p1.id = t.from_point_id
    JOIN points p2 ON p2.id = t.to_point_id
    WHERE p1.region_id = ?
      AND p2.region_id = ?
    ORDER BY t.from_point_id, t.to_point_id
  `,

  // 15. 이동시간 캐시 저장/갱신
  upsertTravelTimeCache: `
    INSERT INTO travel_time_cache (
      from_point_id,
      to_point_id,
      transport_mode,
      travel_min,
      provider
    )
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      travel_min = VALUES(travel_min),
      provider = VALUES(provider),
      calculated_at = CURRENT_TIMESTAMP
  `,

  // 16. 예약 생성
  createReservation: `
    INSERT INTO reservations (
      user_id,
      region_id,
      guide_id,
      survey_id,
      selected_course_rank,
      total_price,
      total_duration_min,
      status,
      reservation_code
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  // 17. 방금 생성한 예약 ID 조회
  getLastInsertIdAsReservationId: `
    SELECT LAST_INSERT_ID() AS reservation_id
  `,

  // 18. 예약 코스 상세 저장
  createReservationItem: `
    INSERT INTO reservation_items (
      reservation_id,
      point_id,
      visit_order,
      arrival_min,
      stay_min
    )
    VALUES (?, ?, ?, ?, ?)
  `,

  // 19. 결제 정보 저장
  createPayment: `
    INSERT INTO payments (
      reservation_id,
      payment_method,
      amount,
      status,
      paid_at
    )
    VALUES (?, ?, ?, ?, ?)
  `,

  // 20. 예약 상태 확정
  confirmReservation: `
    UPDATE reservations
    SET status = 'confirmed'
    WHERE id = ?
  `,

  // 21. 사용자 예약 목록 조회
  getReservationsByUserId: `
    SELECT
      r.id AS reservation_id,
      r.reservation_code,
      r.status,
      r.selected_course_rank,
      r.total_price,
      r.total_duration_min,
      r.created_at,
      rg.name AS region_name,
      g.name AS guide_name,
      p.status AS payment_status
    FROM reservations r
    JOIN regions rg ON rg.id = r.region_id
    JOIN guides g ON g.id = r.guide_id
    LEFT JOIN payments p ON p.reservation_id = r.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `,

  // 22. 예약 상세 조회
  getReservationDetailById: `
    SELECT
      r.id AS reservation_id,
      r.reservation_code,
      r.status,
      r.selected_course_rank,
      r.total_price,
      r.total_duration_min,
      rg.name AS region_name,
      g.name AS guide_name,
      g.intro AS guide_intro,
      pay.payment_method,
      pay.status AS payment_status,
      pay.paid_at
    FROM reservations r
    JOIN regions rg ON rg.id = r.region_id
    JOIN guides g ON g.id = r.guide_id
    LEFT JOIN payments pay ON pay.reservation_id = r.id
    WHERE r.id = ?
  `,

  // 23. 예약 코스 방문 순서 조회
  getReservationItemsByReservationId: `
    SELECT
      ri.visit_order,
      ri.arrival_min,
      ri.stay_min,
      p.id AS point_id,
      p.name AS point_name,
      p.description,
      p.image_url,
      p.duration_min,
      p.open_min,
      p.close_min
    FROM reservation_items ri
    JOIN points p ON p.id = ri.point_id
    WHERE ri.reservation_id = ?
    ORDER BY ri.visit_order
  `,

  // 24. 예약 취소
  cancelReservation: `
    UPDATE reservations
    SET status = 'cancelled'
    WHERE id = ?
      AND user_id = ?
  `,

  // 25. 결제 취소/환불 상태 변경
  cancelPaymentByReservationId: `
    UPDATE payments
    SET status = 'cancelled'
    WHERE reservation_id = ?
  `,

  // 26. 홈 화면용 최근 예약 1건 조회
  getLatestReservationByUserId: `
    SELECT
      r.id AS reservation_id,
      r.reservation_code,
      r.status,
      rg.name AS region_name,
      g.name AS guide_name,
      r.created_at
    FROM reservations r
    JOIN regions rg ON rg.id = r.region_id
    JOIN guides g ON g.id = r.guide_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
    LIMIT 1
  `,

  // 27. 특정 지역의 포인트 목록 조회
  getPointsByRegionId: `
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url,
      p.duration_min,
      p.open_min,
      p.close_min,
      p.reservation_required
    FROM points p
    WHERE p.region_id = ?
      AND p.is_active = TRUE
    ORDER BY p.id
  `,

  // 28. 특정 포인트 상세 + 키워드 조회
  getPointDetailWithKeywords: `
    SELECT
      p.id AS point_id,
      p.name AS point_name,
      p.description,
      p.image_url,
      p.duration_min,
      p.open_min,
      p.close_min,
      p.reservation_required,
      k.id AS keyword_id,
      k.name AS keyword_name,
      k.type AS keyword_type
    FROM points p
    LEFT JOIN point_keywords pk ON pk.point_id = p.id
    LEFT JOIN keywords k ON k.id = pk.keyword_id
    WHERE p.id = ?
    ORDER BY k.id
  `,
};

module.exports = sqlQueries;