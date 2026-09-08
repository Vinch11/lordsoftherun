ALTER TABLE public.grid_bonuses ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE public.grid_bonuses ADD COLUMN IF NOT EXISTS correct boolean;

CREATE TABLE IF NOT EXISTS public.grid_bonus_answers (
  bonus_id uuid PRIMARY KEY REFERENCES public.grid_bonuses(id) ON DELETE CASCADE,
  answer text NOT NULL
);
GRANT SELECT ON public.grid_bonus_answers TO authenticated;
GRANT ALL ON public.grid_bonus_answers TO service_role;
ALTER TABLE public.grid_bonus_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grid bonus answers readable by owner" ON public.grid_bonus_answers;
CREATE POLICY "grid bonus answers readable by owner" ON public.grid_bonus_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.grid_bonuses b JOIN public.games g ON g.id = b.game_id
    WHERE b.id = grid_bonus_answers.bonus_id AND g.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.add_grid_bonus_with_question(
  _game_id uuid, _lat double precision, _lng double precision,
  _radius_m double precision, _lifetime_s integer, _question text, _answer text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _bonus_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not the game owner';
  END IF;

  INSERT INTO public.grid_bonuses (game_id, lat, lng, radius_m, expires_at, question)
  VALUES (_game_id, _lat, _lng, _radius_m, now() + make_interval(secs => _lifetime_s), _question)
  RETURNING id INTO _bonus_id;

  INSERT INTO public.grid_bonus_answers (bonus_id, answer) VALUES (_bonus_id, _answer);

  RETURN _bonus_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_grid_bonus_with_question(uuid, double precision, double precision, double precision, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_grid_bonus_with_question(uuid, double precision, double precision, double precision, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.answer_grid_bonus(_bonus_id uuid, _team_id uuid, _answer text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id uuid;
  _correct_answer text;
  _is_correct boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT game_id INTO _game_id FROM public.grid_bonuses WHERE id = _bonus_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'bonus not found';
  END IF;
  IF NOT private.is_game_participant(_game_id) THEN
    RAISE EXCEPTION 'not a participant of this game';
  END IF;

  UPDATE public.grid_bonuses
     SET claimed_by_team_id = _team_id, claimed_at = now()
   WHERE id = _bonus_id AND claimed_by_team_id IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT answer INTO _correct_answer FROM public.grid_bonus_answers WHERE bonus_id = _bonus_id;
  _is_correct := _correct_answer IS NOT NULL AND lower(btrim(_answer)) = lower(btrim(_correct_answer));

  UPDATE public.grid_bonuses SET correct = _is_correct WHERE id = _bonus_id;

  RETURN _is_correct;
END;
$$;
REVOKE ALL ON FUNCTION public.answer_grid_bonus(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.answer_grid_bonus(uuid, uuid, text) TO authenticated;