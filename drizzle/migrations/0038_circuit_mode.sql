-- "Circuit" mode: a timed Mario-Kart-style race. The organizer draws the
-- track freehand on the map; the client resamples that stroke into evenly
-- spaced checkpoints (see src/lib/circuit.ts) which get stored here in
-- order. Teams race laps around the checkpoint sequence; mystery boxes
-- grant a random item (shield / boost / banana / lightning) that adjusts a
-- team's race time. Ranking = fastest total time once finished, or
-- lap+checkpoint progress while still racing.
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
-- Defaults to 1, not 0: checkpoint 0 is the start/finish line, so a fresh
-- team spawning there must already be aiming for checkpoint 1, not treat
-- standing at the start as an instant lap completion.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_next_checkpoint integer NOT NULL DEFAULT 1;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_time_adjustment_s double precision NOT NULL DEFAULT 0;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_finished_at timestamptz;
-- Currently only 'banana' can be held (drawn from a mystery box, placed on
-- demand); a team can't draw a new item while holding one.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_held_item text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS circuit_shielded boolean NOT NULL DEFAULT false;

-- Ordered checkpoints resampled from the organizer's freehand stroke.
CREATE TABLE IF NOT EXISTS public.circuit_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  seq_index integer NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  UNIQUE (game_id, seq_index)
);

-- Mystery boxes: fixed locations placed by the organizer. They never get
-- consumed — each team has its own cooldown (circuit_box_pickups) so
-- several teams passing at once all get an item.
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

-- Dropped banana traps: visible to everyone, single-use (deleted once an
-- opposing team crosses it).
CREATE TABLE IF NOT EXISTS public.circuit_bananas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circuit_checkpoints_game_idx ON public.circuit_checkpoints(game_id);
CREATE INDEX IF NOT EXISTS circuit_boxes_game_idx ON public.circuit_boxes(game_id);
CREATE INDEX IF NOT EXISTS circuit_box_pickups_box_team_idx ON public.circuit_box_pickups(box_id, team_id);
CREATE INDEX IF NOT EXISTS circuit_bananas_game_idx ON public.circuit_bananas(game_id);

ALTER TABLE public.circuit_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_box_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_bananas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circuit_checkpoints readable" ON public.circuit_checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "circuit_checkpoints managed by owner" ON public.circuit_checkpoints FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

CREATE POLICY "circuit_boxes readable" ON public.circuit_boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "circuit_boxes managed by owner" ON public.circuit_boxes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

CREATE POLICY "circuit_box_pickups readable by participants" ON public.circuit_box_pickups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circuit_boxes b WHERE b.id = box_id AND private.is_game_participant(b.game_id)));
CREATE POLICY "circuit_box_pickups insertable by participants" ON public.circuit_box_pickups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.circuit_boxes b WHERE b.id = box_id AND private.is_game_participant(b.game_id)));

CREATE POLICY "circuit_bananas readable" ON public.circuit_bananas FOR SELECT TO authenticated USING (true);
CREATE POLICY "circuit_bananas insertable by participants" ON public.circuit_bananas FOR INSERT TO authenticated
  WITH CHECK (private.is_game_participant(game_id));
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
