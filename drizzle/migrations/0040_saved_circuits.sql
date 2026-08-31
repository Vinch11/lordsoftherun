-- Lets a prof save a drawn Circuit track (its ordered checkpoints) and
-- re-apply it to a future game, the same way saved_points already lets
-- them reuse a landmark/forbidden-zone template.
CREATE TABLE IF NOT EXISTS public.saved_circuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  points jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.saved_circuits TO authenticated;
GRANT ALL ON public.saved_circuits TO service_role;

ALTER TABLE public.saved_circuits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_circuits owned" ON public.saved_circuits;
CREATE POLICY "saved_circuits owned" ON public.saved_circuits
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS saved_circuits_owner_idx ON public.saved_circuits(owner_id);
