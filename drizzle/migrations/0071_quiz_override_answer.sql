CREATE OR REPLACE FUNCTION public.override_quiz_answer(_team_id uuid, _round_sent_at timestamptz, _correct boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _game_id uuid;
  _old_correct boolean;
  _bonus numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT a.game_id, a.correct INTO _game_id, _old_correct
    FROM public.quiz_answers a
    WHERE a.team_id = _team_id AND a.round_sent_at = _round_sent_at;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'answer not found';
  END IF;

  -- Only the game owner (teacher) may override an answer.
  IF NOT EXISTS (SELECT 1 FROM public.games g WHERE g.id = _game_id AND g.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not the game owner';
  END IF;

  -- No-op when the requested state already matches.
  IF _old_correct IS NOT DISTINCT FROM _correct THEN
    RETURN;
  END IF;

  SELECT r.bonus_amount INTO _bonus
    FROM public.quiz_rounds r
    WHERE r.game_id = _game_id AND r.sent_at = _round_sent_at;
  IF _bonus IS NULL THEN
    _bonus := 0;
  END IF;

  UPDATE public.quiz_answers
    SET correct = _correct
    WHERE team_id = _team_id AND round_sent_at = _round_sent_at;

  IF _correct THEN
    UPDATE public.teams SET landmark_bonus_m2 = landmark_bonus_m2 + _bonus WHERE id = _team_id;
  ELSE
    UPDATE public.teams SET landmark_bonus_m2 = GREATEST(0, landmark_bonus_m2 - _bonus) WHERE id = _team_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.override_quiz_answer(uuid, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_quiz_answer(uuid, timestamptz, boolean) TO service_role;