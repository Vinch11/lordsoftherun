-- Mode "chacun chez soi" : le prof peut choisir de ne pas demander aux
-- élèves de sélectionner leur prénom (juste leur équipe), et peut créer des
-- équipes nommées à la main sans forcément importer un CSV de classe.
-- La création manuelle d'équipe ne demande aucune nouvelle policy : un
-- insert par le prof (sans classe/étudiants) passe déjà par la policy
-- existante "teams insertable by session owner" grâce à la colonne
-- claimed_by qui se remplit toute seule avec auth.uid() par défaut.

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS require_student_name boolean NOT NULL DEFAULT true;
