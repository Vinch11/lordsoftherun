-- "Piège" mechanic (Territoire): a claimed trap-kind landmark grants the
-- claiming team a short window to place a hidden trap elsewhere on the
-- map. Traps stay invisible to every other team — RLS only ever lets the
-- placing team or the game owner read a row — and are triggered through a
-- SECURITY DEFINER RPC that never leaks an unclaimed trap's position to
-- the team that steps on it (the distance check happens server-side).
ALTER TABLE public.landmarks DROP CONSTRAINT IF EXISTS landmarks_kind_check;
ALTER TABLE public.landmarks ADD CONSTRAINT landmarks_kind_check CHECK (kind IN ('points', 'shield', 'trap'));

CREATE TABLE IF NOT EXISTS public.traps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  placed_by_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  source_landmark_id uuid NOT NULL UNIQUE REFERENCES public.landmarks(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  penalty_m2 double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  triggered_by_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  triggered_at timestamptz
);

GRANT SELECT ON public.traps TO authenticated;
GRANT ALL ON public.traps TO service_role;

ALTER TABLE public.traps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "traps readable by placer or owner" ON public.traps;
CREATE POLICY "traps readable by placer or owner" ON public.traps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = placed_by_team_id
        AND (
          t.claimed_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.team_members tm WHERE tm.team_id = t.id AND tm.member_uid = auth.uid()
          )
        )
    )
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid())
  );
-- No INSERT/UPDATE/DELETE policy: place_trap() and check_trap_trigger()
-- (both SECURITY DEFINER, below) are the only ways to write here.

CREATE INDEX IF NOT EXISTS traps_game_idx ON public.traps(game_id);

CREATE OR REPLACE FUNCTION public.place_trap(
  _landmark_id uuid, _lat double precision, _lng double precision
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _team_id uuid;
  _game_id uuid;
  _penalty double precision;
  _kind text;
BEGIN
  SELECT claimed_by_team_id, game_id, bonus_m2, kind
    INTO _team_id, _game_id, _penalty, _kind
    FROM public.landmarks WHERE id = _landmark_id;
  IF _team_id IS NULL THEN
    RAISE EXCEPTION 'landmark not claimed';
  END IF;
  IF _kind != 'trap' THEN
    RAISE EXCEPTION 'not a trap landmark';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id
      AND (
        t.claimed_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.team_members tm WHERE tm.team_id = t.id AND tm.member_uid = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'not this team';
  END IF;

  INSERT INTO public.traps (game_id, placed_by_team_id, source_landmark_id, lat, lng, penalty_m2)
  VALUES (_game_id, _team_id, _landmark_id, _lat, _lng, _penalty);
END;
$$;
REVOKE ALL ON FUNCTION public.place_trap(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_trap(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_trap_trigger(
  _team_id uuid, _lat double precision, _lng double precision, _radius_m double precision DEFAULT 15
)
RETURNS TABLE(triggered boolean, penalty_m2 double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id uuid;
  _found_id uuid;
  _found_penalty double precision;
BEGIN
  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id
      AND (
        t.claimed_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.team_members tm WHERE tm.team_id = t.id AND tm.member_uid = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'not this team';
  END IF;

  SELECT tr.id, tr.penalty_m2 INTO _found_id, _found_penalty
  FROM public.traps tr
  WHERE tr.game_id = _game_id
    AND tr.placed_by_team_id != _team_id
    AND tr.triggered_by_team_id IS NULL
    AND 6371000 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(_lat)) * cos(radians(tr.lat)) * cos(radians(tr.lng) - radians(_lng))
        + sin(radians(_lat)) * sin(radians(tr.lat))
      ))
    ) <= _radius_m
  ORDER BY tr.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _found_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::double precision;
    RETURN;
  END IF;

  UPDATE public.traps SET triggered_by_team_id = _team_id, triggered_at = now()
  WHERE id = _found_id AND triggered_by_team_id IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::double precision;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, _found_penalty;
END;
$$;
REVOKE ALL ON FUNCTION public.check_trap_trigger(uuid, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_trap_trigger(uuid, double precision, double precision, double precision) TO authenticated;
