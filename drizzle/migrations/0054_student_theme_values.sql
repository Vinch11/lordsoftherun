ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_student_theme_check;
UPDATE public.games SET student_theme = 'dossard' WHERE student_theme NOT IN ('dossard','esport','apple','athletic');
ALTER TABLE public.games ADD CONSTRAINT games_student_theme_check CHECK (student_theme IN ('dossard','esport','apple','athletic'));