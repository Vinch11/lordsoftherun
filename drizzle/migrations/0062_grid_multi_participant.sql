-- Lets several students of the same Grille team play simultaneously from
-- their own phone (like Territoire's async mode already does), each
-- capturing cells under their own feet for their shared team score.
--
-- team_members already exists for exactly this (non-exclusive membership,
-- vs. the exclusive claimed_by used by the "one continuous device" modes).
-- It's extended here with a per-device position/distance, since Grille
-- needs to show every participant on the map and add up their distance —
-- unlike teams.lat/lng/total_distance_m, which only ever hold the single
-- most-recently-synced device's numbers and would silently overwrite one
-- participant's progress with another's.

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

-- Migration 0050 ("Missing game options") replaced this function and, in
-- the process, silently dropped the auth.uid() guard and the
-- team_members insert that 0049 had added — so a second participant
-- joining a team stopped being recognized by is_game_participant() at
-- all beyond that one RPC call. Restoring both here, on top of 0050's own
-- student-matching logic (kept as-is), plus stamping the new game_id
-- column on the team_members row.
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

-- One participant's live position + the distance they covered since their
-- last sync (added, not overwritten, so concurrent teammates never clobber
-- each other's total the way an absolute write would).
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

-- Grid's "running bonus" cell count was a JS read-modify-write
-- (awardRunningBonusCell): harmless with one device per team, but two
-- teammates capturing a bonus cell within the same moment could race and
-- one's point would silently overwrite the other's. Atomic increment fixes
-- it regardless of how many participants a team has.
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
