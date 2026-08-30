-- 1. Private schema for security-definer helpers (keeps them out of the API surface)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Each device that joins gets its own auth identity (anonymous for students)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS claimed_by uuid DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS teams_claimed_by_idx ON public.teams(claimed_by);

-- 3. Move is_admin out of the exposed schema
CREATE OR REPLACE FUNCTION private.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_game_participant(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.game_id = _game_id AND t.claimed_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = _game_id AND g.owner_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.is_game_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_game_participant(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    NEW.role := OLD.role;
    NEW.approved := OLD.approved;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "profiles readable by self or admin" ON public.profiles;
CREATE POLICY "profiles readable by self or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles updatable by self or admin" ON public.profiles;
CREATE POLICY "profiles updatable by self or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR private.is_admin(auth.uid()));
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- 4. Reads require a session (anonymous sessions count); no world-readable game state
REVOKE SELECT ON public.games, public.teams, public.territories, public.flags,
  public.landmarks, public.forbidden_zones, public.grid_cells, public.messages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.teams, public.territories, public.flags,
  public.landmarks, public.grid_cells, public.messages, public.photo_submissions FROM anon;

DROP POLICY IF EXISTS "games readable" ON public.games;
CREATE POLICY "games readable" ON public.games FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "teams readable" ON public.teams;
CREATE POLICY "teams readable" ON public.teams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "territories readable" ON public.territories;
CREATE POLICY "territories readable" ON public.territories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "flags readable" ON public.flags;
CREATE POLICY "flags readable" ON public.flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "landmarks readable" ON public.landmarks;
CREATE POLICY "landmarks readable" ON public.landmarks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "forbidden_zones readable" ON public.forbidden_zones;
CREATE POLICY "forbidden_zones readable" ON public.forbidden_zones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "grid_cells readable" ON public.grid_cells;
CREATE POLICY "grid_cells readable" ON public.grid_cells FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "messages readable" ON public.messages;
CREATE POLICY "messages readable" ON public.messages FOR SELECT TO authenticated USING (true);

-- 5. Writes require taking part in that game
DROP POLICY IF EXISTS "teams insertable" ON public.teams;
CREATE POLICY "teams insertable by session owner" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (claimed_by = auth.uid() AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id));
DROP POLICY IF EXISTS "teams updatable" ON public.teams;
CREATE POLICY "teams updatable by participants" ON public.teams FOR UPDATE TO authenticated
  USING (private.is_game_participant(game_id)) WITH CHECK (private.is_game_participant(game_id));
DROP POLICY IF EXISTS "teams deletable" ON public.teams;
CREATE POLICY "teams deletable by owner or game owner" ON public.teams FOR DELETE TO authenticated
  USING (claimed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

DROP POLICY IF EXISTS "territories insertable" ON public.territories;
CREATE POLICY "territories insertable by participants" ON public.territories FOR INSERT TO authenticated
  WITH CHECK (private.is_game_participant(game_id));
DROP POLICY IF EXISTS "territories updatable" ON public.territories;
CREATE POLICY "territories updatable by participants" ON public.territories FOR UPDATE TO authenticated
  USING (private.is_game_participant(game_id)) WITH CHECK (private.is_game_participant(game_id));
DROP POLICY IF EXISTS "territories deletable" ON public.territories;
CREATE POLICY "territories deletable by participants" ON public.territories FOR DELETE TO authenticated
  USING (private.is_game_participant(game_id));

DROP POLICY IF EXISTS "flags updatable" ON public.flags;
CREATE POLICY "flags updatable by participants" ON public.flags FOR UPDATE TO authenticated
  USING (private.is_game_participant(game_id)) WITH CHECK (private.is_game_participant(game_id));

DROP POLICY IF EXISTS "landmarks claimable" ON public.landmarks;
CREATE POLICY "landmarks claimable by participants" ON public.landmarks FOR UPDATE TO authenticated
  USING (private.is_game_participant(game_id)) WITH CHECK (private.is_game_participant(game_id));

DROP POLICY IF EXISTS "grid_cells insertable" ON public.grid_cells;
CREATE POLICY "grid_cells insertable by participants" ON public.grid_cells FOR INSERT TO authenticated
  WITH CHECK (private.is_game_participant(game_id));
DROP POLICY IF EXISTS "grid_cells updatable" ON public.grid_cells;
CREATE POLICY "grid_cells updatable by participants" ON public.grid_cells FOR UPDATE TO authenticated
  USING (private.is_game_participant(game_id)) WITH CHECK (private.is_game_participant(game_id));

DROP POLICY IF EXISTS "messages insertable" ON public.messages;
CREATE POLICY "messages insertable by participants" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (private.is_game_participant(game_id));

DROP POLICY IF EXISTS "photo submissions insertable" ON public.photo_submissions;
CREATE POLICY "photo submissions insertable by participants" ON public.photo_submissions FOR INSERT TO authenticated
  WITH CHECK (private.is_game_participant(game_id)
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.game_id = game_id));

-- 6. Storage: uploads only into a game the uploader takes part in
DROP POLICY IF EXISTS "team photos upload" ON storage.objects;
CREATE POLICY "team photos upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND private.is_game_participant(((storage.foldername(name))[1])::uuid)
  );
