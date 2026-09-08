-- Lets the teacher manually flip a quiz answer's correctness after the
-- fact — a typo, an unexpected but valid phrasing, anything the exact
-- string match in submit_quiz_answer couldn't judge fairly. Crediting/
-- revoking the bonus happens exactly once per flip, atomically, so
-- toggling back and forth never double-pays or double-charges a team.
CREATE OR REPLACE FUNCTION public.override_quiz_answer(
  _team_id uuid, _round_sent_at timestamptz, _correct boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id uuid;
  _bonus numeric;
  _was_correct boolean;
BEGIN
  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not the game owner';
  END IF;

  SELECT correct INTO _was_correct
    FROM public.quiz_answers WHERE team_id = _team_id AND round_sent_at = _round_sent_at;
  IF _was_correct IS NULL THEN
    RAISE EXCEPTION 'answer not found';
  END IF;
  IF _was_correct IS NOT DISTINCT FROM _correct THEN
    RETURN;
  END IF;

  SELECT bonus_amount INTO _bonus
    FROM public.quiz_rounds WHERE game_id = _game_id AND sent_at = _round_sent_at;

  UPDATE public.quiz_answers SET correct = _correct
    WHERE team_id = _team_id AND round_sent_at = _round_sent_at;

  IF _correct THEN
    UPDATE public.teams SET landmark_bonus_m2 = landmark_bonus_m2 + _bonus WHERE id = _team_id;
  ELSE
    UPDATE public.teams SET landmark_bonus_m2 = GREATEST(0, landmark_bonus_m2 - _bonus) WHERE id = _team_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.override_quiz_answer(uuid, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.override_quiz_answer(uuid, timestamptz, boolean) TO authenticated;
