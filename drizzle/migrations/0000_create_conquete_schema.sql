CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  duration_minutes integer NOT NULL DEFAULT 20,
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games readable" ON public.games FOR SELECT USING (true);
CREATE POLICY "games insertable" ON public.games FOR INSERT WITH CHECK (true);
CREATE POLICY "games updatable" ON public.games FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "games deletable" ON public.games FOR DELETE USING (true);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  lat double precision,
  lng double precision,
  score_m2 double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams readable" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams insertable" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "teams updatable" ON public.teams FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "teams deletable" ON public.teams FOR DELETE USING (true);

CREATE TABLE public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  geometry jsonb NOT NULL,
  area_m2 double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.territories TO anon, authenticated;
GRANT ALL ON public.territories TO service_role;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "territories readable" ON public.territories FOR SELECT USING (true);
CREATE POLICY "territories insertable" ON public.territories FOR INSERT WITH CHECK (true);
CREATE POLICY "territories updatable" ON public.territories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "territories deletable" ON public.territories FOR DELETE USING (true);

CREATE INDEX territories_game_idx ON public.territories(game_id);
CREATE INDEX teams_game_idx ON public.teams(game_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.territories;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.territories REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;