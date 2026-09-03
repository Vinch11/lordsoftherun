-- Lets an admin explicitly reject a pending teacher account instead of only
-- being able to approve it. NULL = no decision yet (still pending); a
-- timestamp records when an admin rejected it, and can be cleared to put
-- the account back in the pending queue.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
