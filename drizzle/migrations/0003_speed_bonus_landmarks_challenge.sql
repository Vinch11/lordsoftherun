-- Running vs walking bonus: each territory row keeps its true geometric area
-- (area_m2, used for the map and for capture subtraction) separate from the
-- score credit it's worth (scored_m2, boosted when the loop was run).
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS scored_m2 double precision NOT NULL DEFAULT 0;
UPDATE public.territories SET scored_m2 = area_m2 WHERE scored_m2 = 0;

-- Two-tier ranking: total_captured_m2 (indicative, "how much ground did you ever
-- enclose") only ever grows; score_m2 (main ranking) reflects territory
-- currently held, boosted by running bonus and landmark bonus.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS total_captured_m2 double precision NOT NULL DEFAULT 0;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS landmark_bonus_m2 double precision NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_team_total_captured()
RETURNS trigger AS $$
BEGIN
  UPDATE public.teams SET total_captured_m2 = total_captured_m2 + NEW.area_m2
  WHERE id = NEW.team_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS territories_bump_total_captured ON public.territories;
CREATE TRIGGER territories_bump_total_captured
  AFTER INSERT ON public.territories
  FOR EACH ROW EXECUTE FUNCTION public.bump_team_total_captured();

-- Landmarks: the teacher drops bonus checkpoints on the map; the first team to
-- pass within range claims the bonus, added to landmark_bonus_m2.
CREATE TABLE IF NOT EXISTS public.landmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  bonus_m2 double precision NOT NULL DEFAULT 30,
  claimed_by_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.landmarks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landmarks TO authenticated;
GRANT ALL ON public.landmarks TO service_role;

ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landmarks readable" ON public.landmarks FOR SELECT USING (true);
CREATE POLICY "landmarks insertable by game owner" ON public.landmarks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.games g WHERE g.id = landmarks.game_id AND g.owner_id = auth.uid())
  );
CREATE POLICY "landmarks deletable by game owner" ON public.landmarks
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.games g WHERE g.id = landmarks.game_id AND g.owner_id = auth.uid())
  );
-- Anonymous teams claim landmarks by racing an UPDATE ... WHERE claimed_by_team_id IS NULL;
-- same open-write trust model already used for teams/territories.
CREATE POLICY "landmarks claimable" ON public.landmarks FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS landmarks_game_idx ON public.landmarks(game_id);

ALTER TABLE public.landmarks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.landmarks;
