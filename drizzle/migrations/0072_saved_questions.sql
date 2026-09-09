-- A teacher's personal library of quiz questions, reusable across games —
-- for both the Territoire/Grille "question bonus" and the grid bonus's
-- optional question gate. Strictly owner-private: never exposed to
-- participants, so plain owner-scoped RLS is enough (no secret-answer
-- split like quiz_rounds needs).
CREATE TABLE IF NOT EXISTS public.saved_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_questions TO authenticated;
GRANT ALL ON public.saved_questions TO service_role;

ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved questions owned" ON public.saved_questions;
CREATE POLICY "saved questions owned" ON public.saved_questions FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS saved_questions_owner_idx ON public.saved_questions(owner_id, created_at DESC);
