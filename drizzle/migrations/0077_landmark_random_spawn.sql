-- Random landmark spawning (Territoire/Capture-the-flag): scattered around
-- the return zone's center, the closest thing those modes have to a defined
-- play area — mirrors Grille's grid_bonus_spawn_mode/interval/max_active.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS landmark_spawn_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS landmark_spawn_radius_m double precision NOT NULL DEFAULT 300;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS landmark_spawn_interval_s integer NOT NULL DEFAULT 90;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS landmark_max_active integer NOT NULL DEFAULT 3;

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_landmark_spawn_mode_check;
ALTER TABLE public.games ADD CONSTRAINT games_landmark_spawn_mode_check
  CHECK (landmark_spawn_mode IN ('manual', 'random'));
