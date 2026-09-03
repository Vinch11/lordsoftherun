ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_student_theme_check;
ALTER TABLE public.games ALTER COLUMN student_theme SET DEFAULT 'classic';
ALTER TABLE public.games ADD CONSTRAINT games_student_theme_check CHECK (student_theme IN ('classic','dossard','esport','apple','athletic'));