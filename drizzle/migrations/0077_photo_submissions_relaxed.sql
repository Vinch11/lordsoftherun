-- Some teams couldn't send their photo check-in even with time left: the
-- INSERT policy tightened in 0026_participant_scoped_rls requires
-- is_game_participant(game_id), which depends on auth.uid() still matching
-- a teams.claimed_by/team_members row for this device. A device whose
-- anonymous session got reset mid-game (killed PWA, cleared storage,
-- private browsing) fails that check on every gated write — but a photo
-- check-in carries no scoring risk, unlike grid_cells/messages, so it
-- doesn't need to be that strict. Relax it back to only checking that
-- team_id actually belongs to game_id, same shape as the original 0002
-- policy before 0026 tightened everything uniformly.
DROP POLICY IF EXISTS "photo submissions insertable by participants" ON public.photo_submissions;
CREATE POLICY "photo submissions insertable" ON public.photo_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.game_id = photo_submissions.game_id));