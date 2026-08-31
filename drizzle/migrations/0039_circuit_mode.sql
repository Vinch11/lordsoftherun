ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_mode_check;
ALTER TABLE public.games ADD CONSTRAINT games_mode_check
  CHECK (mode IN ('territoire', 'capture_drapeau', 'grille', 'circuit'));

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_checkpoint_count integer NOT NULL DEFAULT 8;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_lap_count integer NOT NULL DEFAULT 3;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_capture_radius_m double precision NOT NULL DEFAULT 12;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_item_cooldown_s integer NOT NULL DEFAULT 8;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_banana_penalty_s integer NOT NULL DEFAULT 15;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_boost_bonus_s integer NOT NULL DEFAULT 10;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS circuit_lightning_penalty_s integer NOT NULL DEFAULT 20;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_lap integer NOT NULL DEFAULT 0;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_next_checkpoint integer NOT NULL DEFAULT 1;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_time_adjustment_s double precision NOT NULL DEFAULT 0;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_finished_at timestamptz;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_held_item text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_shielded boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.circuit_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  seq_index integer NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  UNIQUE (game_id, seq_index)
);

CREATE TABLE IF NOT EXISTS public.circuit_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS public.circuit_box_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES public.circuit_boxes(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  picked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.circuit_bananas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circuit_checkpoints TO authenticated;
GRANT ALL ON public.circuit_checkpoints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circuit_boxes TO authenticated;
GRANT ALL ON public.circuit_boxes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circuit_box_pickups TO authenticated;
GRANT ALL ON public.circuit_box_pickups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circuit_bananas TO authenticated;
GRANT ALL ON public.circuit_bananas TO service_role;

CREATE INDEX IF NOT EXISTS circuit_checkpoints_game_idx ON public.circuit_checkpoints(game_id);
CREATE INDEX IF NOT EXISTS circuit_boxes_game_idx ON public.circuit_boxes(game_id);
CREATE INDEX IF NOT EXISTS circuit_box_pickups_box_team_idx ON public.circuit_box_pickups(box_id, team_id);
CREATE INDEX IF NOT EXISTS circuit_bananas_game_idx ON public.circuit_bananas(game_id);

ALTER TABLE public.circuit_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_box_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_bananas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circuit_checkpoints readable" ON public.circuit_checkpoints;
CREATE POLICY "circuit_checkpoints readable" ON public.circuit_checkpoints FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "circuit_checkpoints managed by owner" ON public.circuit_checkpoints;
CREATE POLICY "circuit_checkpoints managed by owner" ON public.circuit_checkpoints FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

DROP POLICY IF EXISTS "circuit_boxes readable" ON public.circuit_boxes;
CREATE POLICY "circuit_boxes readable" ON public.circuit_boxes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "circuit_boxes managed by owner" ON public.circuit_boxes;
CREATE POLICY "circuit_boxes managed by owner" ON public.circuit_boxes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

DROP POLICY IF EXISTS "circuit_box_pickups readable by participants" ON public.circuit_box_pickups;
CREATE POLICY "circuit_box_pickups readable by participants" ON public.circuit_box_pickups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circuit_boxes b WHERE b.id = box_id AND private.is_game_participant(b.game_id)));
DROP POLICY IF EXISTS "circuit_box_pickups insertable by participants" ON public.circuit_box_pickups;
CREATE POLICY "circuit_box_pickups insertable by participants" ON public.circuit_box_pickups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.circuit_boxes b WHERE b.id = box_id AND private.is_game_participant(b.game_id)));

DROP POLICY IF EXISTS "circuit_bananas readable" ON public.circuit_bananas;
CREATE POLICY "circuit_bananas readable" ON public.circuit_bananas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "circuit_bananas insertable by participants" ON public.circuit_bananas;
CREATE POLICY "circuit_bananas insertable by participants" ON public.circuit_bananas FOR INSERT TO authenticated
  WITH CHECK (private.is_game_participant(game_id));
DROP POLICY IF EXISTS "circuit_bananas deletable by participants" ON public.circuit_bananas;
CREATE POLICY "circuit_bananas deletable by participants" ON public.circuit_bananas FOR DELETE TO authenticated
  USING (private.is_game_participant(game_id));

ALTER TABLE public.circuit_checkpoints REPLICA IDENTITY FULL;
ALTER TABLE public.circuit_boxes REPLICA IDENTITY FULL;
ALTER TABLE public.circuit_box_pickups REPLICA IDENTITY FULL;
ALTER TABLE public.circuit_bananas REPLICA IDENTITY FULL;
DO $pub$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='circuit_checkpoints') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circuit_checkpoints;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='circuit_boxes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circuit_boxes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='circuit_bananas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circuit_bananas;
  END IF;
END $pub$;