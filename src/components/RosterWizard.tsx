import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Shuffle, UserMinus, Users, X } from "lucide-react";
import { TEAM_COLORS } from "@/lib/conquete";
import type { ParsedStudent } from "@/lib/students";

export type ComposedTeam = { name: string; color: string; members: string[] };

type Props = {
  players: ParsedStudent[];
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (
    roster: { name: string; present: boolean }[],
    teams: ComposedTeam[],
  ) => void | Promise<void>;
};

type Step = "presence" | "teams";

/**
 * Two-step import assistant, mirroring the flow used in "Tournoi Facile":
 * 1. check who is present, 2. build the teams automatically or by hand.
 */
export function RosterWizard({ players, open, busy = false, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>("presence");
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [teamCount, setTeamCount] = useState(4);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [assignments, setAssignments] = useState<string[][]>([]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [dragged, setDragged] = useState<string | null>(null);
  const [pickTarget, setPickTarget] = useState<string | null>(null);

  const presentPlayers = useMemo(
    () => players.filter((p) => !absent.has(p.name)),
    [players, absent],
  );

  useEffect(() => {
    if (!open) return;
    setStep("presence");
    setAbsent(new Set());
    setMode("auto");
    setPickTarget(null);
    setTeamCount(Math.min(TEAM_COLORS.length, Math.max(2, Math.ceil(players.length / 4))));
  }, [open, players]);

  useEffect(() => {
    setTeamNames(Array.from({ length: teamCount }, (_, i) => `Équipe ${i + 1}`));
  }, [teamCount]);

  useEffect(() => {
    if (step !== "teams") return;
    if (mode === "auto") {
      const shuffled = [...presentPlayers.map((p) => p.name)].sort(() => Math.random() - 0.5);
      const next: string[][] = Array.from({ length: teamCount }, () => []);
      shuffled.forEach((name, i) => next[i % teamCount]!.push(name));
      setAssignments(next);
      setUnassigned([]);
    } else {
      setAssignments(Array.from({ length: teamCount }, () => []));
      setUnassigned(presentPlayers.map((p) => p.name));
    }
  }, [step, mode, teamCount, presentPlayers]);

  if (!open) return null;

  function toggleAbsent(name: string) {
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function assign(name: string, teamIndex: number) {
    setAssignments((prev) => {
      const next = prev.map((team) => team.filter((n) => n !== name));
      next[teamIndex] = [...(next[teamIndex] ?? []), name];
      return next;
    });
    setUnassigned((prev) => prev.filter((n) => n !== name));
    setPickTarget(null);
  }

  function unassign(name: string) {
    setAssignments((prev) => prev.map((team) => team.filter((n) => n !== name)));
    setUnassigned((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  const teams: ComposedTeam[] = assignments
    .map((members, i) => ({
      name: teamNames[i]?.trim() || `Équipe ${i + 1}`,
      color: TEAM_COLORS[i % TEAM_COLORS.length]!.hex,
      members,
    }))
    .filter((t) => t.members.length > 0);

  return (
    <div className="fixed inset-0 z-[1200] overflow-y-auto bg-background sm:bg-black/70 sm:p-4">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3 bg-background p-4 sm:panel sm:min-h-0"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-background py-2">
          <span className="section-title flex-1">
            {step === "presence" ? (
              <>
                <UserMinus className="h-4 w-4" /> Présences ({presentPlayers.length}/
                {players.length})
              </>
            ) : (
              <>
                <Users className="h-4 w-4" /> Composer les équipes
              </>
            )}
          </span>
          <button type="button" aria-label="Fermer" className="icon-btn" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "presence" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="seg-btn" onClick={() => setAbsent(new Set())}>
                Tous présents
              </button>
              <button
                type="button"
                className="seg-btn"
                onClick={() => setAbsent(new Set(players.map((p) => p.name)))}
              >
                Tous absents
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {players.map((p) => {
                const present = !absent.has(p.name);
                return (
                  <button
                    key={p.name}
                    type="button"
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-left"
                    aria-pressed={present}
                    onClick={() => toggleAbsent(p.name)}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        present ? "bg-primary text-primary-foreground" : "opacity-40"
                      }`}
                    >
                      {present && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={`flex-1 truncate text-sm ${
                        present ? "" : "text-muted-foreground line-through"
                      }`}
                    >
                      {p.name}
                    </span>
                    {p.group && (
                      <span className="text-xs text-muted-foreground">{p.group}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="sticky bottom-0 z-10 mt-auto bg-background pb-[env(safe-area-inset-bottom)] pt-3">
              <button
                type="button"
                className="btn-huge btn-huge-dark w-full"
                disabled={presentPlayers.length < 2}
                onClick={() => {
                  setStep("teams");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Composer les équipes <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="seg-btn"
                data-active={mode === "auto"}
                onClick={() => setMode("auto")}
              >
                Automatique
              </button>
              <button
                type="button"
                className="seg-btn"
                data-active={mode === "manual"}
                onClick={() => setMode("manual")}
              >
                Manuel
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Nombre d'équipes</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Moins d'équipes"
                  className="icon-btn"
                  onClick={() => setTeamCount((v) => Math.max(2, v - 1))}
                >
                  −
                </button>
                <span className="display w-10 text-center text-xl">{teamCount}</span>
                <button
                  type="button"
                  aria-label="Plus d'équipes"
                  className="icon-btn"
                  onClick={() => setTeamCount((v) => Math.min(TEAM_COLORS.length, v + 1))}
                >
                  +
                </button>
                {mode === "auto" && (
                  <button
                    type="button"
                    aria-label="Mélanger"
                    className="icon-btn"
                    onClick={() => setTeamCount((v) => v)}
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {mode === "manual" && (
                <div
                  className="rounded-md border border-dashed p-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dragged && unassign(dragged)}
                >
                  <p className="mb-1 text-xs text-muted-foreground">
                    Élèves à placer ({unassigned.length}) — touchez un nom puis une équipe.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {unassigned.map((name) => (
                      <button
                        key={name}
                        type="button"
                        draggable
                        onDragStart={() => setDragged(name)}
                        onClick={() => setPickTarget(pickTarget === name ? null : name)}
                        className="rounded-md px-2 py-1 text-sm"
                        data-active={pickTarget === name}
                        style={{
                          background:
                            pickTarget === name
                              ? "hsl(var(--primary) / 0.3)"
                              : "hsl(var(--muted) / 0.4)",
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {assignments.map((members, i) => (
                <div
                  key={i}
                  className="rounded-md border p-2"
                  style={{ borderColor: TEAM_COLORS[i % TEAM_COLORS.length]!.hex }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dragged && assign(dragged, i)}
                  onClick={() => pickTarget && assign(pickTarget, i)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: TEAM_COLORS[i % TEAM_COLORS.length]!.hex }}
                    />
                    <input
                      className="field flex-1 py-1 text-sm"
                      value={teamNames[i] ?? ""}
                      onChange={(e) =>
                        setTeamNames((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">{members.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {members.map((name) => (
                      <span
                        key={name}
                        draggable
                        onDragStart={() => setDragged(name)}
                        className="flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1 text-sm"
                      >
                        {name}
                        <button
                          type="button"
                          aria-label={`Retirer ${name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            unassign(name);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 z-10 mt-auto grid grid-cols-2 gap-2 bg-background pb-[env(safe-area-inset-bottom)] pt-3">
              <button type="button" className="seg-btn" onClick={() => setStep("presence")}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <button
                type="button"
                className="btn-huge btn-huge-dark"
                disabled={busy || teams.length < 2}
                onClick={() =>
                  void onConfirm(
                    players.map((p) => ({ name: p.name, present: !absent.has(p.name) })),
                    teams,
                  )
                }
              >
                <Check className="h-5 w-5" /> Valider
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
