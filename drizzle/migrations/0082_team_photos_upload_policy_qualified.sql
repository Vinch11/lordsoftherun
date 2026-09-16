-- The relaxed "team photos upload" policy from 0080 used a bare `name`
-- inside the EXISTS subquery. Correlated against `public.teams t`, that
-- bare `name` got resolved to the wrong column — `teams.name` (the team's
-- display name) rather than the intended `storage.objects.name` (the
-- upload's file path) — silently turning the check into "parse the team's
-- display name as a gameId/teamId path", which always failed and rejected
-- every photo upload for every team, not just reset-session devices.
-- Qualifying every `name` reference removes the ambiguity.
DROP POLICY IF EXISTS "team photos upload" ON storage.objects;
CREATE POLICY "team photos upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-photos'
    AND (storage.foldername(storage.objects.name))[1] IS NOT NULL
    AND (storage.foldername(storage.objects.name))[2] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = ((storage.foldername(storage.objects.name))[2])::uuid
        AND t.game_id = ((storage.foldername(storage.objects.name))[1])::uuid
    )
  );
