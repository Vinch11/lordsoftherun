ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.games(id) ON DELETE CASCADE;
UPDATE public.team_members tm SET game_id = t.game_id
  FROM public.teams t WHERE t.id = tm.team_id AND tm.game_id IS NULL;
ALTER TABLE public.team_members ALTER COLUMN game_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS team_members_game_id_idx ON public.team_members(game_id);

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS total_distance_m double precision NOT NULL DEFAULT 0;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.team_members REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='team_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.join_team_member(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _student_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _game_id uuid;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'unknown team';
  END IF;

  IF _student_id IS NOT NULL THEN
    UPDATE public.students
       SET team_id = _team_id, present = true
     WHERE id = _student_id AND game_id = _game_id
    RETURNING id INTO _id;
  ELSIF _student_name IS NOT NULL AND btrim(_student_name) <> '' THEN
    SELECT id INTO _id
      FROM public.students
     WHERE game_id = _game_id AND lower(name) = lower(btrim(_student_name))
     LIMIT 1;

    IF _id IS NULL THEN
      INSERT INTO public.students (game_id, name, present, team_id)
      VALUES (_game_id, btrim(_student_name), true, _team_id)
      RETURNING id INTO _id;
    ELSE
      UPDATE public.students SET team_id = _team_id, present = true WHERE id = _id;
    END IF;
  ELSE
    _id := NULL;
  END IF;

  INSERT INTO public.team_members (team_id, game_id, member_uid, student_id)
  VALUES (_team_id, _game_id, auth.uid(), _id)
  ON CONFLICT (team_id, member_uid) DO UPDATE SET student_id = excluded.student_id, joined_at = now();

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_team_member(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_member(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_team_member_position(
  _team_id uuid, _lat double precision, _lng double precision, _distance_delta_m double precision
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;
  UPDATE public.team_members
  SET lat = _lat, lng = _lng,
      total_distance_m = total_distance_m + GREATEST(_distance_delta_m, 0),
      updated_at = now()
  WHERE team_id = _team_id AND member_uid = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a member of this team';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_team_member_position(uuid, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_member_position(uuid, double precision, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_team_bonus_cells(_team_id uuid, _amount int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_game_participant((SELECT game_id FROM public.teams WHERE id = _team_id)) THEN
    RAISE EXCEPTION 'not a participant of this game';
  END IF;
  UPDATE public.teams SET landmark_bonus_m2 = landmark_bonus_m2 + _amount WHERE id = _team_id;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_team_bonus_cells(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_team_bonus_cells(uuid, int) TO authenticated;