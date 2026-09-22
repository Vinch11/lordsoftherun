ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS current_trail jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS loop_active boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.update_team_member_position(uuid, double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.update_team_member_position(
  _team_id uuid, _lat double precision, _lng double precision, _distance_delta_m double precision,
  _current_trail jsonb DEFAULT NULL, _loop_active boolean DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  UPDATE public.team_members
  SET lat = _lat, lng = _lng,
      total_distance_m = total_distance_m + GREATEST(_distance_delta_m, 0),
      current_trail = COALESCE(_current_trail, current_trail),
      loop_active = COALESCE(_loop_active, loop_active),
      updated_at = now()
  WHERE team_id = _team_id AND member_uid = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a member of this team';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_member_position(uuid, double precision, double precision, double precision, jsonb, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_team_member_position(uuid, double precision, double precision, double precision, jsonb, boolean) TO authenticated;