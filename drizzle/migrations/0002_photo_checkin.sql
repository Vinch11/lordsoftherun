ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS photo_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_deadline timestamptz;

CREATE TABLE IF NOT EXISTS public.photo_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.photo_submissions TO anon;
GRANT SELECT, INSERT ON public.photo_submissions TO authenticated;
GRANT ALL ON public.photo_submissions TO service_role;

ALTER TABLE public.photo_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo submissions insertable"
  ON public.photo_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "photo submissions readable by game owner"
  ON public.photo_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = photo_submissions.game_id AND g.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS photo_submissions_game_idx ON public.photo_submissions (game_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS photo_submissions_team_idx ON public.photo_submissions (team_id);

ALTER TABLE public.photo_submissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_submissions;

CREATE POLICY "team photos upload"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'team-photos');

CREATE POLICY "team photos readable by game owner"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'team-photos'
    AND EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.owner_id = auth.uid()
        AND g.id::text = (storage.foldername(name))[1]
    )
  );
