-- Capture-the-flag: a second game mode, fully independent from "territoire"
-- (no loops, no territory polygons — teams fetch and deliver flags instead).
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'territoire'
  CHECK (mode IN ('territoire', 'capture_drapeau'));

-- What happens to a carried flag when its carrier gets tagged by another
-- team, all organizer-configurable:
--  - time_penalty:    flag goes home, carrying team loses points
--  - return_to_base:  flag goes home, no score penalty
--  - flag_dropped:    flag stays on the ground where the tag happened
--  - organizer_replaces: flag is frozen until the organizer taps a new spot
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ctf_capture_consequence text NOT NULL DEFAULT 'return_to_base'
  CHECK (ctf_capture_consequence IN ('time_penalty', 'return_to_base', 'flag_dropped', 'organizer_replaces'));
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ctf_time_penalty_m2 double precision NOT NULL DEFAULT 50;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ctf_capture_radius_m double precision NOT NULL DEFAULT 8;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS flags_captured integer NOT NULL DEFAULT 0;
-- Temporary tag immunity granted by a defensive "shield" landmark pickup.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS shield_until timestamptz;

-- One flag per team: its home base (placed by the organizer), and its live
-- status. While "carried", the flag's displayed position is the carrying
-- team's own live lat/lng (already tracked on public.teams), not a column
-- here, so nothing needs to be written on every GPS tick.
CREATE TABLE IF NOT EXISTS public.flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'home' CHECK (status IN ('home', 'carried', 'dropped', 'awaiting_placement')),
  carried_by_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, team_id)
);

GRANT SELECT, UPDATE ON public.flags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flags TO authenticated;
GRANT ALL ON public.flags TO service_role;

ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flags readable" ON public.flags;
CREATE POLICY "flags readable" ON public.flags FOR SELECT USING (true);
DROP POLICY IF EXISTS "flags insertable by game owner" ON public.flags;
CREATE POLICY "flags insertable by game owner" ON public.flags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.games g WHERE g.id = flags.game_id AND g.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "flags deletable by game owner" ON public.flags;
CREATE POLICY "flags deletable by game owner" ON public.flags
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.games g WHERE g.id = flags.game_id AND g.owner_id = auth.uid())
  );
-- Teams race to pick up / recover / deliver flags with open updates, the same
-- trust model already used for teams/territories/landmarks.
DROP POLICY IF EXISTS "flags updatable" ON public.flags;
CREATE POLICY "flags updatable" ON public.flags FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS flags_game_idx ON public.flags(game_id);

ALTER TABLE public.flags REPLICA IDENTITY FULL;
DO $pub$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='flags') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flags;
  END IF;
END $pub$;

-- A landmark can now optionally be a defensive "shield" pickup (temporary tag
-- immunity, for capture-the-flag) instead of a points bonus. Reusing the
-- landmark placement/timing/claim system rather than building a parallel one.
ALTER TABLE public.landmarks ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'points'
  CHECK (kind IN ('points', 'shield'));
ALTER TABLE public.landmarks ADD COLUMN IF NOT EXISTS shield_duration_s integer NOT NULL DEFAULT 30;
ALTER TABLE public.saved_points ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'points'
  CHECK (kind IN ('points', 'shield'));
ALTER TABLE public.saved_points ADD COLUMN IF NOT EXISTS shield_duration_s integer NOT NULL DEFAULT 30;
