-- Territoire "endurance" check: penalizes stopping/going too slow instead
-- of rewarding speed (the opposite of running_bonus), so a team is forced
-- to keep moving without needing to sprint. Two independent thresholds,
-- mirroring the existing vehicle-speed check but inverted: below
-- endurance_stop_speed_kmh for endurance_stop_grace_s seconds means a team
-- has actually stopped; below endurance_slow_speed_kmh (a light-jog pace)
-- for endurance_slow_grace_s seconds means they're moving but too slowly.
-- Both repeat every grace period while the condition holds (see
-- jouer.$teamId.tsx), so a team can't just eat one penalty and rest.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS endurance_check_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endurance_stop_speed_kmh numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS endurance_stop_grace_s integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS endurance_stop_penalty_m2 numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS endurance_slow_speed_kmh numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS endurance_slow_grace_s integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS endurance_slow_penalty_m2 numeric NOT NULL DEFAULT 5;
