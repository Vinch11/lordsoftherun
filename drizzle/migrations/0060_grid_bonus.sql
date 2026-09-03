-- "Grille" mode explosive bonuses: the teacher spawns them (randomly, on a
-- timer, or by placing them by hand); the first team to walk over one
-- explodes it, claiming every grid cell within its radius. An unclaimed
-- bonus simply expires (stops rendering/being claimable) once its lifetime
-- runs out — nothing deletes it from under a client mid-check, the
-- `expires_at` timestamp is just no longer in the future.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_bonus_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_bonus_spawn_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_bonus_radius_m double precision NOT NULL DEFAULT 12;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_bonus_lifetime_s integer NOT NULL DEFAULT 60;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_bonus_interval_s integer NOT NULL DEFAULT 45;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_bonus_max_active integer NOT NULL DEFAULT 2;

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_grid_bonus_spawn_mode_check;
ALTER TABLE public.games ADD CONSTRAINT games_grid_bonus_spawn_mode_check
  CHECK (grid_bonus_spawn_mode IN ('manual', 'random'));

CREATE TABLE IF NOT EXISTS public.grid_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m double precision NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_by_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grid_bonuses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grid_bonuses TO authenticated;
GRANT ALL ON public.grid_bonuses TO service_role;

ALTER TABLE public.grid_bonuses ENABLE ROW LEVEL SECURITY;

-- Same open trust model as grid_cells/landmarks: any client can read, the
-- teacher's browser inserts/removes bonuses, and any team's app can claim one.
DROP POLICY IF EXISTS "grid_bonuses readable" ON public.grid_bonuses;
CREATE POLICY "grid_bonuses readable" ON public.grid_bonuses FOR SELECT USING (true);
DROP POLICY IF EXISTS "grid_bonuses insertable" ON public.grid_bonuses;
CREATE POLICY "grid_bonuses insertable" ON public.grid_bonuses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "grid_bonuses updatable" ON public.grid_bonuses;
CREATE POLICY "grid_bonuses updatable" ON public.grid_bonuses FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "grid_bonuses deletable" ON public.grid_bonuses;
CREATE POLICY "grid_bonuses deletable" ON public.grid_bonuses FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS grid_bonuses_game_idx ON public.grid_bonuses(game_id);

ALTER TABLE public.grid_bonuses REPLICA IDENTITY FULL;
DO $pub$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='grid_bonuses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grid_bonuses;
  END IF;
END $pub$;