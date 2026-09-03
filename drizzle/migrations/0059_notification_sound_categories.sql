-- Lets the teacher pick a distinct alert sound for chat messages, photo
-- requests, and the end-of-game whistle. Each defaults to null, meaning
-- "use the game's general notification_sound" — nothing to migrate for
-- existing games, they just keep hearing one sound everywhere until the
-- teacher opts into per-category overrides.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS notification_sound_message text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS notification_sound_photo text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS notification_sound_end text;

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_notification_sound_message_check;
ALTER TABLE public.games ADD CONSTRAINT games_notification_sound_message_check
  CHECK (notification_sound_message IS NULL OR notification_sound_message IN ('discreet', 'double_beep', 'chime', 'siren', 'long_alert', 'intense'));

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_notification_sound_photo_check;
ALTER TABLE public.games ADD CONSTRAINT games_notification_sound_photo_check
  CHECK (notification_sound_photo IS NULL OR notification_sound_photo IN ('discreet', 'double_beep', 'chime', 'siren', 'long_alert', 'intense'));

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_notification_sound_end_check;
ALTER TABLE public.games ADD CONSTRAINT games_notification_sound_end_check
  CHECK (notification_sound_end IS NULL OR notification_sound_end IN ('discreet', 'double_beep', 'chime', 'siren', 'long_alert', 'intense'));