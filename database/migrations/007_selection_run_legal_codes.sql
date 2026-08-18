USE halmae_tour;

ALTER TABLE poi_selection_runs
  ADD COLUMN l_dong_regn_cd VARCHAR(10) NULL,
  ADD COLUMN l_dong_signgu_cd VARCHAR(10) NULL;