CREATE OR REPLACE FUNCTION public.update_team_member_position(_team_id uuid, _lat double precision, _lng double precision, _distance_delta_m double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _game_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT t.game_id INTO _game_id FROM public.teams t WHERE t.id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'unknown team';
  END IF;

  INSERT INTO public.team_members (team_id, member_uid, game_id, lat, lng, total_distance_m, updated_at)
  VALUES (_team_id, auth.uid(), _game_id, _lat, _lng, GREATEST(_distance_delta_m, 0), now())
  ON CONFLICT (team_id, member_uid) DO UPDATE
    SET lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        game_id = EXCLUDED.game_id,
        total_distance_m = public.team_members.total_distance_m + GREATEST(_distance_delta_m, 0),
        updated_at = now();

  UPDATE public.teams
    SET lat = _lat, lng = _lng, updated_at = now()
    WHERE id = _team_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_team_member_position(uuid, double precision, double precision, double precision) TO authenticated;