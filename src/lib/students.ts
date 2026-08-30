import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_COLORS } from "@/lib/conquete";

export type Student = {
  id: string;
  game_id: string;
  name: string;
  present: boolean;
  team_id: string | null;
};

export function useStudents(gameId: string | null) {
  const [students, setStudents] = useState<Student[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("game_id", gameId)
      .order("name");
    setStudents((data ?? []) as unknown as Student[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`students-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { students, refresh };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Extracts student names from an iDoceo gradebook export: first row is a
 * header (its own first cell is empty), every following row's first cell is
 * a student's full name, the rest are per-assignment grades we don't care
 * about here. Trailing blank rows (iDoceo pads a few) have an empty first
 * cell too, so they're dropped along with the header.
 */
export function parseIdoceoRoster(csvText: string): string[] {
  const lines = csvText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const names: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const name = parseCsvLine(lines[i]!)[0]?.trim();
    if (name) names.push(name);
  }
  return names;
}

/** Replaces the whole roster for a game — re-importing a corrected CSV starts clean. */
export async function importRoster(gameId: string, names: string[]): Promise<void> {
  await supabase.from("students").delete().eq("game_id", gameId);
  if (names.length === 0) return;
  const { error } = await supabase
    .from("students")
    .insert(names.map((name) => ({ game_id: gameId, name })));
  if (error) throw error;
}

export async function setStudentPresent(studentId: string, present: boolean): Promise<void> {
  const { error } = await supabase.from("students").update({ present }).eq("id", studentId);
  if (error) throw error;
}

export async function assignStudentTeam(studentId: string, teamId: string | null): Promise<void> {
  const { error } = await supabase.from("students").update({ team_id: teamId }).eq("id", studentId);
  if (error) throw error;
}

/**
 * Wipes any teams already created for this game and deals the present
 * students evenly into `teamCount` fresh ones — safe pre-game, since at
 * that point no territory/score data exists yet to lose.
 */
export async function shuffleTeams(
  gameId: string,
  students: Student[],
  teamCount: number,
): Promise<void> {
  await supabase.from("teams").delete().eq("game_id", gameId);

  const newTeams = Array.from({ length: teamCount }, (_, i) => ({
    game_id: gameId,
    name: `Équipe ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length]!.hex,
  }));
  const { data: createdTeams, error } = await supabase.from("teams").insert(newTeams).select();
  if (error || !createdTeams) throw error ?? new Error("team creation failed");

  const present = students.filter((s) => s.present);
  for (let i = present.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [present[i], present[j]] = [present[j]!, present[i]!];
  }
  await Promise.all(
    present.map((s, i) =>
      supabase
        .from("students")
        .update({ team_id: createdTeams[i % createdTeams.length]!.id })
        .eq("id", s.id),
    ),
  );
}

function toCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Triggers a browser download of a CSV built from `rows`, BOM-prefixed so
 * Excel/iDoceo pick up UTF-8 accents correctly. */
export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map(toCsvField).join(",")).join("\r\n");
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
