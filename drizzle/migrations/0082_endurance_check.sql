ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS endurance_check_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endurance_stop_speed_kmh numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS endurance_stop_grace_s integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS endurance_stop_penalty_m2 numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS endurance_slow_speed_kmh numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS endurance_slow_grace_s integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS endurance_slow_penalty_m2 numeric NOT NULL DEFAULT 5;