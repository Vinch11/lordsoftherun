CREATE TABLE IF NOT EXISTS public.game_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.game_templates TO authenticated;
GRANT ALL ON public.game_templates TO service_role;

ALTER TABLE public.game_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_templates owned" ON public.game_templates;
CREATE POLICY "game_templates owned" ON public.game_templates FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS game_templates_owner_idx ON public.game_templates(owner_id, created_at DESC);