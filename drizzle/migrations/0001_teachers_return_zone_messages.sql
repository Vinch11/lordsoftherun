-- 1. games: owner + zone de retour
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS return_lat double precision;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS return_lng double precision;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS return_radius_m double precision NOT NULL DEFAULT 25;

CREATE INDEX IF NOT EXISTS games_owner_id_idx ON public.games (owner_id);

-- Policies games : lecture publique (les élèves rejoignent avec un code),
-- écriture réservée au propriétaire authentifié.
DROP POLICY IF EXISTS "games insertable" ON public.games;
DROP POLICY IF EXISTS "games updatable" ON public.games;
DROP POLICY IF EXISTS "games deletable" ON public.games;

CREATE POLICY "games insertable by owner" ON public.games
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "games updatable by owner" ON public.games
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "games deletable by owner" ON public.games
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

GRANT SELECT ON public.games TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;

-- 2. teams: validation par l'enseignant
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS validated boolean NOT NULL DEFAULT false;

-- 3. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'prof',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages readable" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages insertable" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages updatable by game owner" ON public.messages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = messages.game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = messages.game_id AND g.owner_id = auth.uid()));
CREATE POLICY "messages deletable by game owner" ON public.messages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = messages.game_id AND g.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS messages_game_id_created_at_idx ON public.messages (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_team_id_idx ON public.messages (team_id);

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
