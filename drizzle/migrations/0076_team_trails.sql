-- Full-session GPS trail per team, independent of scoring — territory
-- loops get trimmed/deleted as other teams' captures overlap them, grid
-- cells only remember the last owner, so neither can answer "where did
-- this team actually walk over the whole game?" after the fact. Appended
-- via one atomic RPC (not a client read-modify-write) so several devices
-- syncing the same team in multi-participant mode never race and drop
-- points; capped at 8000 points per team as a simple growth guard for
-- very long (async/"chacun chez soi") games.
CREATE TABLE IF NOT EXISTS public.team_trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

GRANT SELECT ON public.team_trails TO authenticated;
GRANT ALL ON public.team_trails TO service_role;

ALTER TABLE public.team_trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team trails readable by game participants" ON public.team_trails;
CREATE POLICY "team trails readable by game participants" ON public.team_trails FOR SELECT TO authenticated
  USING (private.is_game_participant(game_id));
-- No INSERT/UPDATE/DELETE policy: only append_team_trail_point()
-- (SECURITY DEFINER, below) ever writes here.

CREATE INDEX IF NOT EXISTS team_trails_game_idx ON public.team_trails(game_id);

CREATE OR REPLACE FUNCTION public.append_team_trail_point(
  _team_id uuid, _lat double precision, _lng double precision
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id uuid;
BEGIN
  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;
  IF NOT private.is_game_participant(_game_id) THEN
    RAISE EXCEPTION 'not a participant of this game';
  END IF;

  INSERT INTO public.team_trails (game_id, team_id, points, updated_at)
  VALUES (_game_id, _team_id, jsonb_build_array(jsonb_build_array(_lat, _lng)), now())
  ON CONFLICT (team_id) DO UPDATE
    SET points = CASE
          WHEN jsonb_array_length(team_trails.points) >= 8000 THEN team_trails.points
          ELSE team_trails.points || jsonb_build_array(jsonb_build_array(_lat, _lng))
        END,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.append_team_trail_point(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_team_trail_point(uuid, double precision, double precision) TO authenticated;