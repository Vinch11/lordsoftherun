-- Teacher accounts now require admin approval before they can create a
-- game (relevant once the app charges for access). One profile row per
-- auth user, with a role and an approval flag.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper so the RLS policy below doesn't recursively
-- re-evaluate itself while checking the caller's own role.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "profiles readable by self or admin" ON public.profiles;
CREATE POLICY "profiles readable by self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles updatable by admin" ON public.profiles;
CREATE POLICY "profiles updatable by admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Every new signup gets a profile automatically: an unapproved 'teacher'
-- by default, pending admin review.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN (SELECT count(*) FROM public.profiles) = 0 THEN 'admin' ELSE 'teacher' END,
    CASE WHEN (SELECT count(*) FROM public.profiles) = 0 THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: grandfather every teacher account that already existed before
-- this migration (nobody who was already testing the app gets locked
-- out), and make the very first one ever created the admin.
INSERT INTO public.profiles (id, email, role, approved, created_at)
SELECT
  u.id,
  u.email,
  CASE WHEN row_number() OVER (ORDER BY u.created_at) = 1 THEN 'admin' ELSE 'teacher' END,
  true,
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Only an approved teacher may create a game.
DROP POLICY IF EXISTS "games insertable by owner" ON public.games;
CREATE POLICY "games insertable by owner" ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.approved = true)
  );
