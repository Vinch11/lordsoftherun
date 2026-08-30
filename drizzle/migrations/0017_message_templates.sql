-- Lets a teacher save frequently-used message bodies (e.g. "Revenez vers la
-- zone de départ !") so they don't have to retype them for every game.
-- Private to the teacher's own account, same ownership model as saved_points.
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates owned" ON public.message_templates;
CREATE POLICY "message_templates owned" ON public.message_templates
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS message_templates_owner_idx ON public.message_templates(owner_id);