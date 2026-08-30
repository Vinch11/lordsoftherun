-- Lets a fresh device claim/re-claim an existing team — e.g. a phone died
-- mid-game and the students switch devices, or the teacher pre-created
-- teams (CSV roster split) and a student needs to claim theirs for the
-- first time. The normal "teams updatable by participants" policy can't
-- cover this: a brand new anonymous session has no existing claim in the
-- game yet, so it isn't a participant until this runs.
CREATE OR REPLACE FUNCTION public.rejoin_team(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;
  UPDATE public.teams SET claimed_by = auth.uid() WHERE id = _team_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rejoin_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rejoin_team(uuid) TO authenticated;
