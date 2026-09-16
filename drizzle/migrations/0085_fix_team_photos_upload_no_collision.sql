DROP POLICY IF EXISTS "team photos upload" ON storage.objects;

CREATE POLICY "team photos upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND ((storage.foldername(name))[1], (storage.foldername(name))[2]) IN (
      SELECT t.game_id::text, t.id::text FROM public.teams t
    )
  );