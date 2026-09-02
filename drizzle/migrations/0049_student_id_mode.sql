-- Remplace le simple on/off "les élèves choisissent leur prénom" par trois
-- façons de s'identifier en mode "chacun chez soi", pour que les équipes
-- créées à la main (sans import CSV) puissent quand même avoir des stats
-- individuelles : l'élève tape juste son prénom au lieu de n'avoir aucune
-- identification.
ALTER TABLE public.games DROP COLUMN IF EXISTS require_student_name;

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS student_id_mode text NOT NULL DEFAULT 'roster';
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_student_id_mode_check;
ALTER TABLE public.games ADD CONSTRAINT games_student_id_mode_check
  CHECK (student_id_mode IN ('roster', 'freetext', 'none'));

-- join_team_member peut désormais créer sa propre fiche élève à la volée
-- (mode "freetext") au lieu d'exiger un élève déjà importé par le prof.
DROP FUNCTION IF EXISTS public.join_team_member(uuid, uuid);

CREATE FUNCTION public.join_team_member(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _student_name text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id uuid;
  _resolved_student_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;

  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;

  IF _student_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.team_id = _team_id) THEN
      RAISE EXCEPTION 'student not on this team';
    END IF;
    _resolved_student_id := _student_id;
  ELSIF _student_name IS NOT NULL AND length(trim(_student_name)) > 0 THEN
    INSERT INTO public.students (game_id, team_id, name, present)
    VALUES (_game_id, _team_id, trim(_student_name), true)
    RETURNING id INTO _resolved_student_id;
  ELSE
    _resolved_student_id := NULL;
  END IF;

  INSERT INTO public.team_members (team_id, member_uid, student_id)
  VALUES (_team_id, auth.uid(), _resolved_student_id)
  ON CONFLICT (team_id, member_uid) DO UPDATE SET student_id = excluded.student_id, joined_at = now();

  RETURN _resolved_student_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_team_member(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_member(uuid, uuid, text) TO authenticated;
