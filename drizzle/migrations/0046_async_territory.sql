-- "Territoire asynchrone" : une partie Territoire qui dure des jours/semaines,
-- où chaque élève lance une boucle quand il le peut (ex. en promenant le
-- chien) plutôt que de garder l'appli ouverte en continu.

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS async_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS loop_close_mode text NOT NULL DEFAULT 'auto';
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_loop_close_mode_check;
ALTER TABLE public.games ADD CONSTRAINT games_loop_close_mode_check
  CHECK (loop_close_mode IN ('auto', 'manual'));

-- Pour qu'une boucle en cours survive à la fermeture de l'appli (appel
-- téléphonique, retour à la maison) : current_trail existe déjà, il ne
-- manque que de savoir qu'une boucle était active pour la reprendre au lieu
-- de la considérer comme jamais commencée.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS loop_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS loop_started_at timestamptz;

-- Plusieurs élèves d'une même équipe (= une classe, en tournoi inter-classes)
-- doivent pouvoir se connecter en même temps depuis leur propre téléphone.
-- Le "claimed_by" existant est exclusif (un seul appareil à la fois) : ça
-- convient à une partie de cours vécue ensemble, mais évincerait un élève
-- dès qu'un camarade de la même classe rejoint l'équipe depuis son propre
-- appareil. team_members ajoute une appartenance non-exclusive, en plus de
-- claimed_by (qui reste utilisé tel quel par les autres modes de jeu).
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_uid uuid NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, member_uid)
);

GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON public.team_members(team_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members readable" ON public.team_members;
CREATE POLICY "team_members readable" ON public.team_members FOR SELECT TO authenticated USING (true);
-- Pas de policy INSERT/UPDATE/DELETE directe : l'appartenance ne se pose que
-- via join_team_member() (SECURITY DEFINER) ci-dessous, pour qu'un appareil
-- ne puisse pas s'ajouter à une équipe sans en connaître le code.

CREATE OR REPLACE FUNCTION private.is_game_participant(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.game_id = _game_id AND t.claimed_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.teams t ON t.id = tm.team_id
      WHERE t.game_id = _game_id AND tm.member_uid = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = _game_id AND g.owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.join_team_member(_team_id uuid, _student_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id) THEN
    RAISE EXCEPTION 'team not found';
  END IF;
  IF _student_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.team_id = _team_id
  ) THEN
    RAISE EXCEPTION 'student not on this team';
  END IF;
  INSERT INTO public.team_members (team_id, member_uid, student_id)
  VALUES (_team_id, auth.uid(), _student_id)
  ON CONFLICT (team_id, member_uid) DO UPDATE SET student_id = excluded.student_id, joined_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.join_team_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_member(uuid, uuid) TO authenticated;

-- Un élève doit pouvoir lire la liste de sa classe pour y choisir son prénom
-- avant de lancer une boucle. Comme teams/games (déjà lisibles par toute
-- session authentifiée, y compris anonyme), students devient lisible ;
-- seules les écritures restent réservées au prof propriétaire de la partie.
DROP POLICY IF EXISTS "students manageable by game owner" ON public.students;

DROP POLICY IF EXISTS "students readable" ON public.students;
CREATE POLICY "students readable" ON public.students FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "students insertable by game owner" ON public.students;
CREATE POLICY "students insertable by game owner" ON public.students FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = students.game_id AND g.owner_id = auth.uid()));

DROP POLICY IF EXISTS "students updatable by game owner" ON public.students;
CREATE POLICY "students updatable by game owner" ON public.students FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = students.game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = students.game_id AND g.owner_id = auth.uid()));

DROP POLICY IF EXISTS "students deletable by game owner" ON public.students;
CREATE POLICY "students deletable by game owner" ON public.students FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = students.game_id AND g.owner_id = auth.uid()));
