-- Fixes a real bug: "certaines équipes n'arrivent pas à envoyer de photos,
-- et réessayer ne change rien". rejoin_team only ever updates the exclusive
-- teams.claimed_by — so whenever a second phone rejoins a team (a common,
-- intended use: a dead phone, borrowing a friend's), it silently evicts
-- whoever rejoined before it. private.is_game_participant() checks
-- claimed_by across the whole game, so the evicted device permanently
-- fails every is_game_participant-gated write (grid_cells, messages, and
-- the "team photos upload"/"photo submissions insertable" policies) from
-- then on — and reopening the app ("resume" in rejoindre.$code.tsx) never
-- re-claims, so retrying the same request keeps failing the same way.
--
-- team_members is the non-exclusive membership already used elsewhere
-- (join_team_member): once a device is in it, it stays a recognized
-- participant no matter who else claims the team afterward. Having
-- rejoin_team also insert into it means every device that has ever
-- legitimately rejoined a team keeps working, in every game mode.
CREATE OR REPLACE FUNCTION public.rejoin_team(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _game_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;

  UPDATE public.teams SET claimed_by = auth.uid() WHERE id = _team_id;

  INSERT INTO public.team_members (team_id, game_id, member_uid)
  VALUES (_team_id, _game_id, auth.uid())
  ON CONFLICT (team_id, member_uid) DO UPDATE SET joined_at = now();
END;
$$;
