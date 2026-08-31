ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS bonus_cells INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_team_bonus_cells(_team_id UUID, _amount INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.teams SET bonus_cells = bonus_cells + GREATEST(_amount, 0) WHERE id = _team_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_team_bonus_cells(UUID, INTEGER) TO anon, authenticated;