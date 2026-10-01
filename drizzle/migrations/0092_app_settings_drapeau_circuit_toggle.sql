-- Small key/value table for app-wide feature toggles the admin controls
-- from the admin page — starting with whether regular teachers can pick
-- Capture du drapeau / Circuit as a game mode. Readable by any signed-in
-- account (every prof dashboard needs to know whether to show the mode
-- buttons), writable only by an admin.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('drapeau_circuit_enabled', false)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings readable by authenticated" ON public.app_settings;
CREATE POLICY "app_settings readable by authenticated" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

-- private.is_admin() already exists (see 0006_admin_approval.sql) as a
-- SECURITY DEFINER helper so this policy doesn't recursively re-check
-- profiles' own RLS while evaluating.
DROP POLICY IF EXISTS "app_settings updatable by admin" ON public.app_settings;
CREATE POLICY "app_settings updatable by admin" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));