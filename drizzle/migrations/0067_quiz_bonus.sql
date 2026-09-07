-- Lets the teacher send a live question during Territoire/Grille: teams
-- that answer correctly get a point bonus. games.quiz_question/quiz_bonus
-- are broadcast to every participant (already-open games RLS), but the
-- correct answer never goes anywhere a participant can read it — it lives
-- only in quiz_rounds (owner-only SELECT) and is checked server-side by
-- submit_quiz_answer, never sent to the client.

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS quiz_question text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS quiz_bonus numeric NOT NULL DEFAULT 25;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS quiz_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.quiz_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL,
  correct_answer text NOT NULL,
  bonus_amount numeric NOT NULL,
  UNIQUE (game_id, sent_at)
);
ALTER TABLE public.quiz_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz rounds readable by owner" ON public.quiz_rounds;
CREATE POLICY "quiz rounds readable by owner" ON public.quiz_rounds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = quiz_rounds.game_id AND g.owner_id = auth.uid()));
-- No INSERT/UPDATE/DELETE policy at all: only send_quiz_question() (below,
-- SECURITY DEFINER) ever writes here, so the answer can never reach a
-- participant's request no matter what the client sends.

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_sent_at timestamptz NOT NULL,
  answer text NOT NULL,
  correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, round_sent_at)
);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz answers readable by owner" ON public.quiz_answers;
CREATE POLICY "quiz answers readable by owner" ON public.quiz_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = quiz_answers.game_id AND g.owner_id = auth.uid()));

ALTER TABLE public.quiz_answers REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='quiz_answers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.send_quiz_question(
  _game_id uuid, _question text, _answer text, _bonus numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sent_at timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not the game owner';
  END IF;
  UPDATE public.games
     SET quiz_question = _question, quiz_bonus = _bonus, quiz_sent_at = _sent_at
   WHERE id = _game_id;
  INSERT INTO public.quiz_rounds (game_id, sent_at, correct_answer, bonus_amount)
  VALUES (_game_id, _sent_at, _answer, _bonus);
END;
$$;
REVOKE ALL ON FUNCTION public.send_quiz_question(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_quiz_question(uuid, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_quiz_question(_game_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not the game owner';
  END IF;
  UPDATE public.games SET quiz_question = NULL, quiz_sent_at = NULL WHERE id = _game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.close_quiz_question(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_quiz_question(uuid) TO authenticated;

-- Checks the answer server-side (the correct answer never reaches the
-- client) and atomically credits the bonus on a correct, first attempt.
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(_team_id uuid, _answer text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id uuid;
  _round_sent_at timestamptz;
  _correct_answer text;
  _bonus numeric;
  _is_correct boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;
  IF NOT private.is_game_participant(_game_id) THEN
    RAISE EXCEPTION 'not a participant of this game';
  END IF;

  SELECT quiz_sent_at INTO _round_sent_at FROM public.games WHERE id = _game_id;
  IF _round_sent_at IS NULL THEN
    RAISE EXCEPTION 'no active question';
  END IF;

  SELECT correct_answer, bonus_amount INTO _correct_answer, _bonus
    FROM public.quiz_rounds WHERE game_id = _game_id AND sent_at = _round_sent_at;
  IF _correct_answer IS NULL THEN
    RAISE EXCEPTION 'round not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_answers WHERE team_id = _team_id AND round_sent_at = _round_sent_at
  ) THEN
    RAISE EXCEPTION 'already answered';
  END IF;

  _is_correct := lower(btrim(_answer)) = lower(btrim(_correct_answer));

  INSERT INTO public.quiz_answers (game_id, team_id, round_sent_at, answer, correct)
  VALUES (_game_id, _team_id, _round_sent_at, _answer, _is_correct);

  IF _is_correct THEN
    UPDATE public.teams SET landmark_bonus_m2 = landmark_bonus_m2 + _bonus WHERE id = _team_id;
  END IF;

  RETURN _is_correct;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, text) TO authenticated;
