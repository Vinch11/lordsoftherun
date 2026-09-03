UPDATE public.games SET student_theme = 'classic' WHERE student_theme = 'esport';
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_student_theme_check;
ALTER TABLE public.games ADD CONSTRAINT games_student_theme_check CHECK (student_theme IN ('classic','dossard','apple','athletic'));