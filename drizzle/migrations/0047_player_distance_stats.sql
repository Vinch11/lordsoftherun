-- Statistiques de distance/vitesse par élève (en plus du total par équipe),
-- pour le mode "chacun chez soi" : plusieurs élèves d'une même équipe jouant
-- en parallèle depuis leur propre téléphone rendait l'ancien
-- lire-modifier-écrire de teams.total_distance_m (chaque appareil réécrivait
-- sa propre copie locale du total) sujet à des écritures qui s'écrasent
-- entre elles. add_distance() applique désormais un incrément atomique côté
-- base, à la fois pour l'équipe et, si connu, pour l'élève qui joue.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_distance_m numeric NOT NULL DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_active_s numeric NOT NULL DEFAULT 0;

-- Temps passé en boucle active (plutôt que le temps total de la partie, qui
-- ne veut rien dire pour une vitesse moyenne sur une conquête d'un mois) :
-- dénominateur d'une vitesse moyenne qui reste pertinente en mode asynchrone.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS total_active_s numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.add_distance(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _delta_m numeric DEFAULT 0,
  _delta_active_s numeric DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR (_delta_m <= 0 AND _delta_active_s <= 0) THEN
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
        total_active_s = total_active_s + GREATEST(_delta_active_s, 0)
    WHERE id = _team_id;

  IF _student_id IS NOT NULL THEN
    UPDATE public.students
      SET total_distance_m = total_distance_m + GREATEST(_delta_m, 0),
          total_active_s = total_active_s + GREATEST(_delta_active_s, 0)
      WHERE id = _student_id AND team_id = _team_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.add_distance(uuid, uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_distance(uuid, uuid, numeric, numeric) TO authenticated;
