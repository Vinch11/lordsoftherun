-- Class roster for a game: imported from a CSV (e.g. iDoceo export), used
-- to take attendance and split present students into teams before a game
-- starts, then to export a per-student result once it's finished. Fully
-- owner-managed — students never sign in individually, only their team's
-- device does.
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  present boolean NOT NULL DEFAULT true,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS students_game_id_idx ON public.students(game_id);
CREATE INDEX IF NOT EXISTS students_team_id_idx ON public.students(team_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manageable by game owner" ON public.students FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = students.game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = students.game_id AND g.owner_id = auth.uid()));
