-- Forbidden zones: entering one costs the team points.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS penalty_m2 double precision NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.forbidden_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m double precision NOT NULL DEFAULT 15,
  penalty_m2 double precision NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.forbidden_zones TO anon;
GRANT SELECT, INSERT, DELETE ON public.forbidden_zones TO authenticated;
GRANT ALL ON public.forbidden_zones TO service_role;

ALTER TABLE public.forbidden_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forbidden_zones readable" ON public.forbidden_zones;
CREATE POLICY "forbidden_zones readable" ON public.forbidden_zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "forbidden_zones insertable by game owner" ON public.forbidden_zones;
CREATE POLICY "forbidden_zones insertable by game owner" ON public.forbidden_zones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.games g WHERE g.id = forbidden_zones.game_id AND g.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "forbidden_zones deletable by game owner" ON public.forbidden_zones;
CREATE POLICY "forbidden_zones deletable by game owner" ON public.forbidden_zones
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.games g WHERE g.id = forbidden_zones.game_id AND g.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS forbidden_zones_game_idx ON public.forbidden_zones(game_id);

ALTER TABLE public.forbidden_zones REPLICA IDENTITY FULL;
DO $pub$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='forbidden_zones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forbidden_zones;
  END IF;
END $pub$;

-- Saved points: a teacher's reusable library of bonus landmarks / forbidden
-- zones (e.g. the same schoolyard used every year), applied to a new game
-- with one tap instead of re-placing everything by hand.
CREATE TABLE IF NOT EXISTS public.saved_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('landmark', 'forbidden')),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m double precision NOT NULL DEFAULT 15,
  value_m2 double precision NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.saved_points TO authenticated;
GRANT ALL ON public.saved_points TO service_role;

ALTER TABLE public.saved_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_points owned" ON public.saved_points;
CREATE POLICY "saved_points owned" ON public.saved_points
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS saved_points_owner_idx ON public.saved_points(owner_id);
