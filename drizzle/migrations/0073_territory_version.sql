-- Optimistic-concurrency guard for territory captures. When several teams
-- close overlapping loops within the same few seconds (very common right
-- when a timer runs out), captureTerritory's read-diff-write sequence can
-- race: two closures both read the same "existing territories" snapshot,
-- each computes its own subtraction against it, and whichever write lands
-- last silently clobbers the other's reduction — teams have been ending up
-- at 0 m² with only one territory left on the map. `version` lets the
-- client detect a stale write (row changed since it was read) and retry
-- the whole capture against a fresh read instead of overwriting blindly.
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
