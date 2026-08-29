-- Multi-teacher accounts: scope games to their owner.
ALTER TABLE public.games ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.games ADD COLUMN return_lat double precision;
ALTER TABLE public.games ADD COLUMN return_lng double precision;
ALTER TABLE public.games ADD COLUMN return_radius_m double precision;

DROP POLICY "games insertable" ON public.games;
CREATE POLICY "games insertable" ON public.games FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY "games updatable" ON public.games;
CREATE POLICY "games updatable" ON public.games FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY "games deletable" ON public.games;
CREATE POLICY "games deletable" ON public.games FOR DELETE USING (auth.uid() = owner_id);

-- Teams: whether they were back in the teacher's return zone when the game ended.
ALTER TABLE public.teams ADD COLUMN validated boolean NOT NULL DEFAULT false;

-- Messages between the teacher and teams (broadcast, direct, or team -> teacher).
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  from_role text NOT NULL CHECK (from_role IN ('prof', 'team')),
  from_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  to_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (from_role = 'team' AND from_team_id IS NOT NULL AND to_team_id IS NULL)
    OR
    (from_role = 'prof' AND from_team_id IS NULL)
  )
);

GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages readable" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages insertable" ON public.messages FOR INSERT WITH CHECK (true);

CREATE INDEX messages_game_idx ON public.messages(game_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
