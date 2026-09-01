-- Lets the prof pick which notification sound plays on students' and their
-- own screen (short/discreet to long/insistent) instead of always the
-- default siren.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS notification_sound text NOT NULL DEFAULT 'siren';

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_notification_sound_check;
ALTER TABLE public.games ADD CONSTRAINT games_notification_sound_check
  CHECK (notification_sound IN ('discreet', 'double_beep', 'chime', 'siren', 'long_alert', 'intense'));