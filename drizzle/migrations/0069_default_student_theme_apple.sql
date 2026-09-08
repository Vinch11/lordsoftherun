-- New games now default to the "Apple Premium" student skin instead of the
-- loud sci-fi "classic" look — lighter chrome, smaller nav/icon buttons, no
-- decorative HUD brackets over the map. Existing games keep whatever theme
-- they already have; this only changes what a brand-new game starts with.
ALTER TABLE public.games ALTER COLUMN student_theme SET DEFAULT 'apple';
