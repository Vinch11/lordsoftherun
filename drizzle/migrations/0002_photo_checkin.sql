-- Photo check-in: the teacher can ask every team for a photo within a delay,
-- e.g. to confirm a group is still together.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS photo_requested_at timestamptz;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS photo_deadline timestamptz;

CREATE TABLE IF NOT EXISTS public.photo_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.photo_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_submissions TO authenticated;
GRANT ALL ON public.photo_submissions TO service_role;

ALTER TABLE public.photo_submissions ENABLE ROW LEVEL SECURITY;

-- Teams can record their own submission (they are anonymous, like the rest of the
-- app), but only the teacher who owns the game can list what was sent in — these
-- are photos of students, so they stay private to the class's own teacher.
CREATE POLICY "photo_submissions insertable" ON public.photo_submissions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "photo_submissions readable by game owner" ON public.photo_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = photo_submissions.game_id AND g.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS photo_submissions_game_idx ON public.photo_submissions(game_id);

ALTER TABLE public.photo_submissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_submissions;

-- Private bucket for the photos themselves: teams can upload, only the owning
-- teacher can read them back (never public).
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "team-photos insertable" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'team-photos');

CREATE POLICY "team-photos readable by game owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'team-photos'
    AND EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id::text = (storage.foldername(name))[1] AND g.owner_id = auth.uid()
    )
  );
