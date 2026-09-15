-- 0074 relaxed the photo_submissions table INSERT policy because a device
-- whose anonymous session got reset mid-game (killed PWA, cleared storage,
-- private browsing) fails is_game_participant() on every gated write, even
-- though a photo check-in carries no scoring risk. That fix only covered
-- the table row, not the storage upload that happens first (uploadTeamPhoto
-- uploads the file, then inserts the row) — the "team photos upload" policy
-- on storage.objects still calls is_game_participant() and rejects the
-- upload before the relaxed table policy is ever reached, so the underlying
-- bug still surfaces as "new row violates row-level security policy" on
-- send. Relax it the same way: only check that the path's team folder
-- actually belongs to the path's game folder, same shape as the
-- photo_submissions policy.
DROP POLICY IF EXISTS "team photos upload" ON storage.objects;
CREATE POLICY "team photos upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = ((storage.foldername(name))[2])::uuid
        AND t.game_id = ((storage.foldername(name))[1])::uuid
    )
  );
