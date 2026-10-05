import { supabase } from "@/integrations/supabase/client";

/**
 * add_distance gained a 6th parameter (_delta_walking_s) in migration 0094.
 * Migrations committed to this repo don't apply themselves — this project
 * syncs to the live database through Lovable, and there's historically been
 * a gap between a migration landing here and Lovable actually applying it
 * (confirmed twice before this one: a missing GRANT, a stale admin-check
 * function reference). If that gap exists for this migration too, PostgREST
 * can't resolve a 6-argument call against a still-5-argument function and
 * every add_distance call fails — with no visible error anywhere, since
 * both play views only toast on a position-sync failure, not a distance
 * one. The result is every team's distance/active/stopped time staying at
 * zero for the whole game, discovered only after the fact on the teacher's
 * dashboard.
 *
 * Falling back to the old 5-argument shape specifically on a "function not
 * found" response keeps distance/active/stopped tracking working through
 * that gap — only the new walking split is silently dropped (not queued for
 * retry) until the migration actually lands, which is a far smaller loss
 * than every stat going to zero.
 */
export async function callAddDistance(args: {
  teamId: string;
  studentId?: string | null;
  deltaM: number;
  deltaActiveS: number;
  deltaStoppedS: number;
  deltaWalkingS: number;
}): Promise<{ error: unknown }> {
  const base = {
    _team_id: args.teamId,
    ...(args.studentId ? { _student_id: args.studentId } : {}),
    _delta_m: args.deltaM,
    _delta_active_s: args.deltaActiveS,
    _delta_stopped_s: args.deltaStoppedS,
  };
  const { error } = await supabase.rpc("add_distance", {
    ...base,
    _delta_walking_s: args.deltaWalkingS,
  });
  if (error && isMissingFunctionError(error)) {
    return supabase.rpc("add_distance", base);
  }
  return { error };
}

function isMissingFunctionError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "PGRST202" || !!e?.message?.includes("Could not find the function");
}
