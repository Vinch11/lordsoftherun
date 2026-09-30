-- "Coefficient d'endurance" in the end-of-game PDF report: régularité
-- (time spent moving without stopping) as the dominant factor, with a
-- capped bonus for distance/speed against an indicative reference speed
-- for the class's year level — teacher-editable, since there is no single
-- authoritative table that maps a national/European average onto a
-- freeform, GPS-tracked continuous run of arbitrary duration.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS endurance_year_level text,
  ADD COLUMN IF NOT EXISTS endurance_speed_ref_kmh numeric;
