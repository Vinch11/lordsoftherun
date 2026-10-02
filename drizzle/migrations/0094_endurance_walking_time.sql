-- The "coefficient d'endurance" used to weight active-vs-stopped time against
-- pace relative to a reference speed — but the actual test it's meant to
-- grade has no target pace at all ("30 minutes à leur propre allure, sans
-- s'arrêter, sans marcher"): the only two things that matter are whether a
-- team stopped and whether it walked. Classifying "walking" after the fact
-- from an average speed would hide a team that ran half the test and walked
-- the other half, so it has to be measured live, the same way total_stopped_s
-- already is: a new accumulator, fed from the same accepted (already
-- jitter-filtered) movement intervals as total_active_s, crediting an
-- interval as walking whenever its implied pace falls under the game's
-- course/marche reference speed.
DROP FUNCTION IF EXISTS public.add_distance(uuid, uuid, numeric, numeric, numeric);

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS total_walking_s numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.add_distance(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _delta_m numeric DEFAULT 0,
  _delta_active_s numeric DEFAULT 0,
  _delta_stopped_s numeric DEFAULT 0,
  _delta_walking_s numeric DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL
    OR (_delta_m <= 0 AND _delta_active_s <= 0 AND _delta_stopped_s <= 0 AND _delta_walking_s <= 0)
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
        total_stopped_s = total_stopped_s + GREATEST(_delta_stopped_s, 0),
        total_walking_s = total_walking_s + GREATEST(_delta_walking_s, 0)
    WHERE id = _team_id;

  IF _student_id IS NOT NULL THEN
    UPDATE public.students
      SET total_distance_m = total_distance_m + GREATEST(_delta_m, 0),
          total_active_s = total_active_s + GREATEST(_delta_active_s, 0)
      WHERE id = _student_id AND team_id = _team_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.add_distance(uuid, uuid, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_distance(uuid, uuid, numeric, numeric, numeric, numeric) TO authenticated;
