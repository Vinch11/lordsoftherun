-- Every anonymous participant session (supabase.auth.signInAnonymously(),
-- used by rejoindre.$code.tsx / src/lib/session.ts) creates a new
-- auth.users row, which the on_auth_user_created trigger was turning into
-- a junk 'teacher' profile stuck in the admin approval queue forever
-- (hundreds of blank-email rows for people who never signed up as a
-- teacher at all). Skip the insert for anonymous users, and clean up the
-- junk rows already created by past anonymous sessions.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_anonymous THEN
    RETURN NEW;
  END IF;

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

DELETE FROM public.profiles p
USING auth.users u
WHERE p.id = u.id AND u.is_anonymous = true;
