-- Running speed bonus becomes a per-game setting instead of a fixed rule:
-- the organizer can turn it off entirely, or set the speed (km/h) above
-- which a closed loop counts as "run".
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS running_bonus_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS running_bonus_speed_kmh double precision NOT NULL DEFAULT 8;

-- Safety option for school activities: only penalize a forbidden zone
-- crossing (e.g. a street) when the team was running through it, not when
-- walking. Off by default (always penalize, the original behavior).
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS forbidden_zone_running_only boolean NOT NULL DEFAULT false;