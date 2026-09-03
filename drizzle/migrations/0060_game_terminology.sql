-- Lets a game carry the terminology (enseignant/organisateur) its creator's
-- account uses, so anonymous participant screens (which have no profile of
-- their own to read a preference from) can pick the right vocabulary. Set
-- once at game-creation time from profiles.terminology; not meant to be
-- edited afterward, so no dashboard toggle for it.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS terminology text NOT NULL DEFAULT 'enseignant';

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_terminology_check;
ALTER TABLE public.games ADD CONSTRAINT games_terminology_check
  CHECK (terminology IN ('enseignant', 'organisateur'));