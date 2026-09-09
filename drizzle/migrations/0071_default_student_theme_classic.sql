-- Reverts 0069: the teacher wants "Classique" as the default student theme
-- again for new games, not "Apple Premium" ("Carte d'orientation"). Both
-- remain available in the theme picker; only the default changes, and only
-- for games created from now on — existing games keep whatever theme they
-- already have.
ALTER TABLE public.games ALTER COLUMN student_theme SET DEFAULT 'classic';
