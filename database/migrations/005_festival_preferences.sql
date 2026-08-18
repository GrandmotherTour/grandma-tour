USE halmae_tour;

ALTER TABLE preference_surveys
  ADD COLUMN travel_date DATE NULL,
  ADD COLUMN include_festival TINYINT(1) NOT NULL DEFAULT 0;