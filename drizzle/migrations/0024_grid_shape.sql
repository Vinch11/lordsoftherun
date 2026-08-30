-- Lets the organizer draw the grille-mode play zone as a rectangle (or a
-- square, by setting equal width/height) instead of only a circle —
-- handy for a rectangular field/court. Circle stays the default so
-- existing games are unaffected.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_shape text NOT NULL DEFAULT 'circle'
  CHECK (grid_shape IN ('circle', 'rectangle'));
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_width_m double precision NOT NULL DEFAULT 80;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS grid_height_m double precision NOT NULL DEFAULT 80;
