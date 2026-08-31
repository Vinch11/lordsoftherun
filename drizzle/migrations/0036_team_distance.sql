-- Total distance moved during the game (all 3 modes), synced at the same
-- throttle as position. Average speed is derived client-side from this and
-- game.started_at rather than stored, since it changes continuously.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS total_distance_m double precision NOT NULL DEFAULT 0;
