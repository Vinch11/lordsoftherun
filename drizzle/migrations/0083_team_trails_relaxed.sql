-- Same bug class as 0074 (photo_submissions): append_team_trail_point()
-- requires is_game_participant(), which depends on auth.uid() still
-- matching a teams.claimed_by/team_members row for this device. A device
-- whose anonymous session got reset mid-game (killed PWA, cleared storage,
-- private browsing) fails that check on every call — and since the client
-- calls this RPC fire-and-forget (no error surfaced to the player), a team
-- can finish a whole game with real score and distance but literally zero
-- trail points recorded, if the reset happened before the very first call
-- ever succeeded. Recording a trail point carries no scoring risk (it's a
-- read-only post-game review feature for the teacher), so it doesn't need
-- to be that strict — same reasoning as 0074, relaxed the same way: only
-- check that the team genuinely exists.
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
