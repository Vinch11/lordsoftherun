-- Anti-cheat: optionally forbid moving faster than walking/running pace
-- (bike, scooter, car) in any game mode. Off by default (vehicles allowed,
-- no check) so existing games are unaffected; when the organizer disallows
-- vehicles, a team sustaining a speed above the threshold for a few
-- seconds takes a one-off penalty (cooldown-gated, same pattern as
-- forbidden zones, to avoid re-penalizing every GPS tick while it lasts).
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS vehicle_allowed boolean NOT NULL DEFAULT true;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS vehicle_speed_threshold_kmh double precision NOT NULL DEFAULT 18;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS vehicle_penalty_m2 double precision NOT NULL DEFAULT 200;