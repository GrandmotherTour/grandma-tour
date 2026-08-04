CREATE DATABASE IF NOT EXISTS halmae_tour
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE halmae_tour;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
);

CREATE TABLE IF NOT EXISTS regions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_regions_name (name)
);

CREATE TABLE IF NOT EXISTS guides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  intro TEXT,
  profile_image_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_guides_region
    FOREIGN KEY (region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS keywords (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  type ENUM('preference', 'environment', 'constraint') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_keywords_name (name)
);

CREATE TABLE IF NOT EXISTS points (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_id BIGINT UNSIGNED NOT NULL,
  guide_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  duration_min SMALLINT UNSIGNED NOT NULL,
  open_min SMALLINT UNSIGNED NOT NULL,
  close_min SMALLINT UNSIGNED NOT NULL,
  reservation_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_points_region
    FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_points_guide
    FOREIGN KEY (guide_id) REFERENCES guides(id)
);

CREATE TABLE IF NOT EXISTS point_keywords (
  point_id BIGINT UNSIGNED NOT NULL,
  keyword_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (point_id, keyword_id),
  CONSTRAINT fk_point_keywords_point
    FOREIGN KEY (point_id) REFERENCES points(id),
  CONSTRAINT fk_point_keywords_keyword
    FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

CREATE TABLE IF NOT EXISTS preference_surveys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  region_id BIGINT UNSIGNED NOT NULL,
  budget INT UNSIGNED NOT NULL,
  start_min SMALLINT UNSIGNED NOT NULL,
  end_min SMALLINT UNSIGNED NOT NULL,
  min_points TINYINT UNSIGNED NOT NULL DEFAULT 2,
  max_points TINYINT UNSIGNED NOT NULL DEFAULT 3,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_preference_surveys_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_preference_surveys_region
    FOREIGN KEY (region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS survey_keywords (
  survey_id BIGINT UNSIGNED NOT NULL,
  keyword_id BIGINT UNSIGNED NOT NULL,
  usage_type ENUM('selected', 'excluded') NOT NULL,
  PRIMARY KEY (survey_id, keyword_id, usage_type),
  CONSTRAINT fk_survey_keywords_survey
    FOREIGN KEY (survey_id) REFERENCES preference_surveys(id),
  CONSTRAINT fk_survey_keywords_keyword
    FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  region_id BIGINT UNSIGNED NOT NULL,
  guide_id BIGINT UNSIGNED NOT NULL,
  survey_id BIGINT UNSIGNED NOT NULL,
  selected_course_rank TINYINT UNSIGNED NOT NULL,
  total_price INT UNSIGNED NOT NULL,
  total_duration_min SMALLINT UNSIGNED NOT NULL,
  status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
  reservation_code VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reservations_code (reservation_code),
  CONSTRAINT fk_reservations_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_reservations_region
    FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_reservations_guide
    FOREIGN KEY (guide_id) REFERENCES guides(id),
  CONSTRAINT fk_reservations_survey
    FOREIGN KEY (survey_id) REFERENCES preference_surveys(id)
);

CREATE TABLE IF NOT EXISTS reservation_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id BIGINT UNSIGNED NOT NULL,
  point_id BIGINT UNSIGNED NOT NULL,
  visit_order TINYINT UNSIGNED NOT NULL,
  arrival_min SMALLINT UNSIGNED NOT NULL,
  stay_min SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reservation_items_order (reservation_id, visit_order),
  CONSTRAINT fk_reservation_items_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  CONSTRAINT fk_reservation_items_point
    FOREIGN KEY (point_id) REFERENCES points(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('card', 'bank_transfer', 'kakaopay', 'naverpay') NOT NULL,
  amount INT UNSIGNED NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_payments_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE IF NOT EXISTS travel_time_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_point_id BIGINT UNSIGNED NOT NULL,
  to_point_id BIGINT UNSIGNED NOT NULL,
  transport_mode ENUM('walking', 'car', 'taxi', 'public_transit') NOT NULL,
  travel_min SMALLINT UNSIGNED NOT NULL,
  provider VARCHAR(50),
  calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_travel_time_cache_route (
    from_point_id,
    to_point_id,
    transport_mode
  ),
  CONSTRAINT fk_travel_time_cache_from_point
    FOREIGN KEY (from_point_id) REFERENCES points(id),
  CONSTRAINT fk_travel_time_cache_to_point
    FOREIGN KEY (to_point_id) REFERENCES points(id)
);
