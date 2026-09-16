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