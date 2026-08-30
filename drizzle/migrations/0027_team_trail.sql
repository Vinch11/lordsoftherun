-- Lets every device see the live in-progress trail (not just the current
-- position) of every team, so opponents can see a loop forming and react
-- strategically. Only territoire mode writes this; other modes leave it at
-- the empty-array default.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS current_trail jsonb NOT NULL DEFAULT '[]'::jsonb;
