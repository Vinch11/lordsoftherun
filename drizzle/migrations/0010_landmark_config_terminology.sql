-- Configurable bonus landmarks: a custom icon, a points value that stays
-- editable after placement, and a visibility window relative to the game's
-- elapsed time (appears after N minutes, disappears after N minutes or stays
-- until claimed).
ALTER TABLE public.landmarks ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '⭐';
ALTER TABLE public.landmarks ADD COLUMN IF NOT EXISTS active_after_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.landmarks ADD COLUMN IF NOT EXISTS active_until_minutes integer;

-- Editing a landmark's icon/bonus/timing is just another UPDATE; the existing
-- wide-open "landmarks claimable" policy (same trust model as teams/territories)
-- already covers it, so no new landmarks policy is needed here.

-- Reusable landmark templates also carry the icon and visibility window.
ALTER TABLE public.saved_points ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '⭐';
ALTER TABLE public.saved_points ADD COLUMN IF NOT EXISTS active_after_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.saved_points ADD COLUMN IF NOT EXISTS active_until_minutes integer;

-- Terminology: an organizer who isn't a school teacher (e.g. a private club)
-- can switch every "enseignant" label in the UI to "organisateur".
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terminology text NOT NULL DEFAULT 'enseignant'
  CHECK (terminology IN ('enseignant', 'organisateur'));

-- A teacher may now update their own profile row (to switch terminology),
-- but a trigger clamps role/approved back to their prior value unless the
-- caller is an admin, so self-service can never grant admin or approval.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.role := OLD.role;
    NEW.approved := OLD.approved;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_protect_privileges ON public.profiles;
CREATE TRIGGER profiles_protect_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

DROP POLICY IF EXISTS "profiles updatable by admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles updatable by self or admin" ON public.profiles;
CREATE POLICY "profiles updatable by self or admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

-- Prior migrations never granted UPDATE at the table level, so neither an
-- admin's approve/revoke nor a teacher's own terminology change could have
-- worked without this (RLS policies only apply on top of a table grant).
GRANT UPDATE ON public.profiles TO authenticated;
