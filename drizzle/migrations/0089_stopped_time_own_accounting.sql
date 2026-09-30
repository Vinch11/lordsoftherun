-- "Temps d'arrêt" was derived on the prof's side as (elapsed time - active
-- time), comparing a clock kept on the student's device (total_active_s,
-- accumulated from GPS sample deltas) against one kept in the prof's own
-- browser (gameElapsedS, from Date.now() - started_at). Any small,
-- structural skew between those two clocks — batching, network latency,
-- sample-boundary rounding — accumulates until total_active_s tips past
-- gameElapsedS, at which point the derived "temps d'arrêt" collapses to
-- zero right as a team resumes moving, even after a real, lengthy stop.
-- Tracked directly from now on, the same way total_active_s already is,
-- so it no longer depends on comparing two independently-drifting clocks.
DROP FUNCTION IF EXISTS public.add_distance(uuid, uuid, numeric, numeric);

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS total_stopped_s numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.add_distance(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _delta_m numeric DEFAULT 0,
  _delta_active_s numeric DEFAULT 0,
  _delta_stopped_s numeric DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL
    OR (_delta_m <= 0 AND _delta_active_s <= 0 AND _delta_stopped_s <= 0)
  THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = _team_id AND (
      t.claimed_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.team_members tm WHERE tm.team_id = t.id AND tm.member_uid = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'not a member of this team';
  END IF;

  UPDATE public.teams
    SET total_distance_m = total_distance_m + GREATEST(_delta_m, 0),
        total_active_s = total_active_s + GREATEST(_delta_active_s, 0),
        total_stopped_s = total_stopped_s + GREATEST(_delta_stopped_s, 0)
    WHERE id = _team_id;

  IF _student_id IS NOT NULL THEN
    UPDATE public.students
      SET total_distance_m = total_distance_m + GREATEST(_delta_m, 0),
          total_active_s = total_active_s + GREATEST(_delta_active_s, 0)
      WHERE id = _student_id AND team_id = _team_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.add_distance(uuid, uuid, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_distance(uuid, uuid, numeric, numeric, numeric) TO authenticated;
