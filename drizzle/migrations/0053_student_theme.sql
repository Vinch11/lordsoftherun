ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS student_theme text NOT NULL DEFAULT 'dossard';

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_student_theme_check;
ALTER TABLE public.games
  ADD CONSTRAINT games_student_theme_check
  CHECK (student_theme IN ('dossard', 'frost', 'crystal', 'glass', 'neo'));