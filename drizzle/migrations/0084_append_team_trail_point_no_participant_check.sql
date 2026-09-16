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