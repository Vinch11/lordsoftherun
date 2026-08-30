-- "Grille" (Splatoon-style) mode: a third game mode, fully independent from
-- territoire and capture_drapeau. The organizer draws a circular play zone;
-- it's divided into square cells, each colored by the last team to walk
-- over it. Score = number of cells currently owned, computed live from this
-- table rather than stored on teams (a cell can change hands at any time
-- without the previous owner doing anything, so there is nothing for them to
-- decrement).
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_mode_check;
ALTER TABLE public.games ADD CONSTRAINT games_mode_check
  CHECK (mode IN ('territoire', 'capture_drapeau', 'grille'));

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_center_lat double precision;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_center_lng double precision;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_radius_m double precision NOT NULL DEFAULT 40;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_cell_size_m double precision NOT NULL DEFAULT 6;

CREATE TABLE IF NOT EXISTS public.grid_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  row integer NOT NULL,
  col integer NOT NULL,
  owner_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, row, col)
);

GRANT SELECT, INSERT, UPDATE ON public.grid_cells TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grid_cells TO authenticated;
GRANT ALL ON public.grid_cells TO service_role;

ALTER TABLE public.grid_cells ENABLE ROW LEVEL SECURITY;

-- Same open trust model as teams/territories/flags: any team can claim any
-- cell, racing on GPS position rather than a server-verified check.
DROP POLICY IF EXISTS "grid_cells readable" ON public.grid_cells;
CREATE POLICY "grid_cells readable" ON public.grid_cells FOR SELECT USING (true);
DROP POLICY IF EXISTS "grid_cells insertable" ON public.grid_cells;
CREATE POLICY "grid_cells insertable" ON public.grid_cells FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "grid_cells updatable" ON public.grid_cells;
CREATE POLICY "grid_cells updatable" ON public.grid_cells FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS grid_cells_game_idx ON public.grid_cells(game_id);

ALTER TABLE public.grid_cells REPLICA IDENTITY FULL;
DO $pub$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='grid_cells') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grid_cells;
  END IF;
END $pub$;
