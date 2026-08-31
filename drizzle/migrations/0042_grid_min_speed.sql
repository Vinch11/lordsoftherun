-- Grille mode: lets the prof require a minimum walking/running speed for a
-- cell to actually be captured (0 = disabled, any speed counts as today).
-- Distinct from the existing running-bonus speed, which only grants an
-- extra point on top of an already-valid capture.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_min_speed_kmh double precision NOT NULL DEFAULT 0;
