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