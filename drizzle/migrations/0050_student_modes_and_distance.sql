-- Missing game options
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS async_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loop_close_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS student_id_mode text NOT NULL DEFAULT 'roster';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_loop_close_mode_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_loop_close_mode_check
      CHECK (loop_close_mode IN ('auto','manual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_student_id_mode_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_student_id_mode_check
      CHECK (student_id_mode IN ('roster','freetext','none'));
  END IF;
END $$;

-- Live loop state on teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS loop_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loop_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_active_s double precision NOT NULL DEFAULT 0;

-- Per-student effort tracking
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS total_distance_m double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_active_s double precision NOT NULL DEFAULT 0;

-- Atomic increment of distance / active time for a team (and optionally the
-- individual student on that device), so concurrent phones never clobber
-- each other with stale read-modify-write updates.
CREATE OR REPLACE FUNCTION public.add_distance(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _delta_m double precision DEFAULT 0,
  _delta_active_s double precision DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.teams
     SET total_distance_m = total_distance_m + COALESCE(_delta_m, 0),
         total_active_s = total_active_s + COALESCE(_delta_active_s, 0)
   WHERE id = _team_id;

  IF _student_id IS NOT NULL THEN
    UPDATE public.students
       SET total_distance_m = total_distance_m + COALESCE(_delta_m, 0),
           total_active_s = total_active_s + COALESCE(_delta_active_s, 0)
     WHERE id = _student_id;
  END IF;
END;
$$;

-- Attaches a student to a team (roster pick or free-text name) and returns
-- the student id the device should remember.
CREATE OR REPLACE FUNCTION public.join_team_member(
  _team_id uuid,
  _student_id uuid DEFAULT NULL,
  _student_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _game_id uuid;
  _id uuid;
BEGIN
  SELECT game_id INTO _game_id FROM public.teams WHERE id = _team_id;
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'unknown team';
  END IF;

  IF _student_id IS NOT NULL THEN
    UPDATE public.students
       SET team_id = _team_id, present = true
     WHERE id = _student_id AND game_id = _game_id
    RETURNING id INTO _id;
    RETURN _id;
  END IF;

  IF _student_name IS NULL OR btrim(_student_name) = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _id
    FROM public.students
   WHERE game_id = _game_id AND lower(name) = lower(btrim(_student_name))
   LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.students (game_id, name, present, team_id)
    VALUES (_game_id, btrim(_student_name), true, _team_id)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.students SET team_id = _team_id, present = true WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_distance(uuid, uuid, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_member(uuid, uuid, text) TO anon, authenticated;