-- End-of-game "grace period": once the whistle blows, teams can be given a
-- configurable window to physically walk back to the return zone before
-- their final score is locked in. Opt-in, available to all three game
-- modes (not just territoire) since capture_drapeau and grille have no
-- built-in "come back" requirement of their own.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grace_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grace_minutes integer NOT NULL DEFAULT 5;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grace_penalty_mode text NOT NULL DEFAULT 'cancel'
  CHECK (grace_penalty_mode IN ('cancel', 'per_second'));
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grace_penalty_per_second_m2 double precision NOT NULL DEFAULT 2;
-- Set once, when the whistle blows, if grace_enabled and a return zone is
-- configured. Every client derives each team's final validated/penalty
-- status from this timestamp plus teams.returned_at below, so nothing
-- needs a periodic server-side sweep once the window elapses.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz;

-- Set once a team's live position is detected inside the return zone
-- during (or after) the grace window; never reset.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS returned_at timestamptz;

-- Whether players see the colored grid cells on their own map in "grille"
-- mode (the organizer's dashboard always does, for monitoring). Turning
-- this off is a harder variant: teams navigate on GPS feel alone.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_show_overlay boolean NOT NULL DEFAULT true;