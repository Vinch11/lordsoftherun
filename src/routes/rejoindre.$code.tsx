import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_COLORS, fetchWithRetry, teamStorageKey } from "@/lib/conquete";
import { fetchTeamRoster, joinTeamMember, type Student } from "@/lib/students";

export const Route = createFileRoute("/rejoindre/$code")({
  head: () => ({
    meta: [
      { title: "Rejoindre une partie — Conquête" },
      {
        name: "description",
        content:
          "Entrez le code à 4 chiffres, choisissez le nom et la couleur de votre équipe, puis partez à la conquête du quartier.",
      },
      { property: "og:title", content: "Rejoindre une partie — Conquête" },
      {
        property: "og:description",
        content: "Code à 4 chiffres, nom d'équipe, couleur : c'est parti.",
      },
    ],
  }),
  component: Join,
});

type ExistingTeam = { id: string; name: string; color: string };

function Join() {
  const navigate = useNavigate();
  const { code: initialCode } = Route.useParams();
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 4));
  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]!.hex);
  const [busy, setBusy] = useState(false);
  const [checkingResume, setCheckingResume] = useState(true);
  const [resumeFailed, setResumeFailed] = useState(false);
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([]);
  const [creatingNew, setCreatingNew] = useState(false);
  const [resumeRetryTick, setResumeRetryTick] = useState(0);
  const [asyncMode, setAsyncMode] = useState(false);
  const [namePickTeam, setNamePickTeam] = useState<ExistingTeam | null>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const storedTeamId = localStorage.getItem(teamStorageKey(code));
    if (!storedTeamId) {
      setCheckingResume(false);
      return;
    }
    setResumeFailed(false);
    void fetchWithRetry<{ id: string }>(() =>
      supabase.from("teams").select("id").eq("id", storedTeamId).maybeSingle(),
    ).then(({ data, error }) => {
      if (!active) return;
      if (data) {
        localStorage.setItem("conquete:last-team", JSON.stringify({ teamId: data.id, code }));
        void navigate({ to: "/jouer/$teamId", params: { teamId: data.id }, replace: true });
      } else if (error) {
        // A network hiccup, not proof the team is gone — keep the stored
        // id and let the student retry instead of wiping it and forcing
        // them to rejoin from scratch (rescanning the QR code, losing
        // their team name/color) over what may just be a flaky connection.
        setResumeFailed(true);
        setCheckingResume(false);
      } else {
        localStorage.removeItem(teamStorageKey(code));
        setCheckingResume(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, resumeRetryTick]);

  // Lists the teams already created for this code, so a student can pick
  // theirs back up instead of always creating a new one — whether that's a
  // team pre-formed by the teacher (CSV roster split) or their own team
  // from earlier, after a dead phone forced them onto a different device.
  useEffect(() => {
    let active = true;
    if (code.length !== 4) {
      setExistingTeams([]);
      return;
    }
    void supabase
      .from("games")
      .select("id, async_mode")
      .eq("code", code)
      .maybeSingle()
      .then(async ({ data: game }) => {
        if (!game) {
          if (active) {
            setExistingTeams([]);
            setAsyncMode(false);
          }
          return;
        }
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, color")
          .eq("game_id", game.id)
          .order("created_at");
        if (active) {
          setExistingTeams(teams ?? []);
          setAsyncMode(game.async_mode);
        }
      });
    return () => {
      active = false;
    };
  }, [code]);

  // Two teams the same color is confusing on the map — once a color is
  // taken, later teams can't pick it too.
  const usedColors = useMemo(() => new Set(existingTeams.map((t) => t.color)), [existingTeams]);
  useEffect(() => {
    if (!usedColors.has(color)) return;
    const free = TEAM_COLORS.find((c) => !usedColors.has(c.hex));
    if (free) setColor(free.hex);
  }, [usedColors, color]);

  useEffect(() => {
    let active = true;
    if (!namePickTeam) {
      setRoster([]);
      return;
    }
    setRosterLoading(true);
    void fetchTeamRoster(namePickTeam.id).then((students) => {
      if (active) {
        setRoster(students);
        setRosterLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [namePickTeam]);

  async function joinAsync(studentId: string) {
    if (!namePickTeam) return;
    setBusy(true);
    try {
      await joinTeamMember(namePickTeam.id, studentId);
      localStorage.setItem(teamStorageKey(code), namePickTeam.id);
      localStorage.setItem("conquete:last-team", JSON.stringify({ teamId: namePickTeam.id, code }));
      await navigate({ to: "/jouer/$teamId", params: { teamId: namePickTeam.id } });
    } catch {
      toast.error("Impossible de rejoindre cette équipe.");
    } finally {
      setBusy(false);
    }
  }

  async function rejoin(teamId: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("rejoin_team", { _team_id: teamId });
      if (error) {
        toast.error("Impossible de rejoindre cette équipe.");
        return;
      }
      localStorage.setItem(teamStorageKey(code), teamId);
      localStorage.setItem("conquete:last-team", JSON.stringify({ teamId, code }));
      await navigate({ to: "/jouer/$teamId", params: { teamId } });
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (code.length !== 4 || !name.trim()) return;
    setBusy(true);
    try {
      const { data: game } = await supabase
        .from("games")
        .select("id, code")
        .eq("code", code)
        .maybeSingle();
      if (!game) {
        toast.error("Aucune partie avec ce code.");
        return;
      }
      const { data: team, error } = await supabase
        .from("teams")
        .insert({ game_id: game.id, name: name.trim(), color })
        .select()
        .maybeSingle();
      if (error || !team) {
        toast.error("Impossible de rejoindre la partie.");
        return;
      }
      localStorage.setItem(teamStorageKey(game.code), team.id);
      localStorage.setItem(
        "conquete:last-team",
        JSON.stringify({ teamId: team.id, code: game.code }),
      );
      await navigate({ to: "/jouer/$teamId", params: { teamId: team.id } });
    } finally {
      setBusy(false);
    }
  }

  if (checkingResume) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg text-muted-foreground">Reconnexion à votre équipe…</p>
      </main>
    );
  }

  if (resumeFailed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Connexion impossible pour le moment. Vérifiez le réseau.</p>
        <button
          className="btn-huge btn-huge-accent"
          onClick={() => {
            setCheckingResume(true);
            setResumeRetryTick((n) => n + 1);
          }}
        >
          Réessayer
        </button>
      </main>
    );
  }

  if (asyncMode) {
    return (
      <main className="min-h-screen px-5 py-8">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <header className="pt-4">
            <div className="pill">
              <Users className="h-3.5 w-3.5" /> Groupe d'élèves
            </div>
            <h1 className="page-title mt-4">
              Re<em>joindre</em>
            </h1>
            <p className="mt-3 text-muted-foreground">
              {namePickTeam
                ? `Qui es-tu dans ${namePickTeam.name} ?`
                : "Entrez le code, puis retrouvez votre classe."}
            </p>
          </header>

          {!namePickTeam && (
            <label className="flex flex-col gap-2">
              <span className="section-title">Code de la partie</span>
              <input
                className="field text-center text-3xl font-bold tracking-[0.4em]"
                inputMode="numeric"
                placeholder="0000"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
          )}

          {namePickTeam ? (
            <>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground underline"
                onClick={() => setNamePickTeam(null)}
              >
                <ArrowLeft className="h-4 w-4" /> Changer d'équipe
              </button>
              <section className="panel flex flex-col gap-2 p-5">
                <span className="section-title">Ton prénom</span>
                {rosterLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun élève dans cette équipe pour l'instant — demande à ton prof de t'ajouter.
                  </p>
                ) : (
                  roster.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void joinAsync(s.id)}
                      className="rounded-2xl bg-secondary/60 px-4 py-3 text-left font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </section>
            </>
          ) : (
            <section className="panel flex flex-col gap-2 p-5">
              <span className="section-title">Ta classe / équipe</span>
              {code.length !== 4 ? (
                <p className="text-sm text-muted-foreground">
                  Entrez le code à 4 chiffres ci-dessus.
                </p>
              ) : existingTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune équipe pour ce code pour l'instant — demandez à votre prof de configurer
                  les classes.
                </p>
              ) : (
                existingTeams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNamePickTeam(t)}
                    className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-left font-semibold transition-transform active:scale-[0.98]"
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border-2 border-foreground"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </button>
                ))
              )}
            </section>
          )}
        </div>
      </main>
    );
  }

  const showPicker = existingTeams.length > 0 && !creatingNew;

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="pt-4">
          <div className="pill">
            <Users className="h-3.5 w-3.5" /> Groupe d'élèves
          </div>
          <h1 className="page-title mt-4">
            Re<em>joindre</em>
          </h1>
          <p className="mt-3 text-muted-foreground">
            {showPicker
              ? "Votre équipe est déjà là ? Retrouvez-la ci-dessous."
              : "Code, nom d'équipe, couleur : et le quartier est à vous."}
          </p>
        </header>

        <label className="flex flex-col gap-2">
          <span className="section-title">Code de la partie</span>
          <input
            className="field text-center text-3xl font-bold tracking-[0.4em]"
            inputMode="numeric"
            placeholder="0000"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>

        {showPicker ? (
          <>
            <section className="panel flex flex-col gap-2 p-5">
              <span className="section-title">Rejoindre une équipe existante</span>
              {existingTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void rejoin(t.id)}
                  className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-left font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border-2 border-foreground"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                </button>
              ))}
            </section>
            <button type="button" className="btn-huge-dark" onClick={() => setCreatingNew(true)}>
              <Plus className="h-5 w-5" /> Créer une nouvelle équipe
            </button>
          </>
        ) : (
          <>
            {existingTeams.length > 0 && (
              <button
                type="button"
                className="text-center text-sm text-muted-foreground underline"
                onClick={() => setCreatingNew(false)}
              >
                ← Rejoindre une équipe existante
              </button>
            )}

            <section className="panel flex flex-col gap-5 p-5">
              <label className="flex flex-col gap-2">
                <span className="section-title">Nom de l'équipe</span>
                <input
                  className="field"
                  placeholder="Les Guépards"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="section-title">Couleur</span>
                <div className="grid grid-cols-4 gap-3">
                  {TEAM_COLORS.map((c) => {
                    const taken = usedColors.has(c.hex);
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={taken ? `${c.name} (déjà prise)` : c.name}
                        disabled={taken}
                        onClick={() => setColor(c.hex)}
                        className={`relative h-16 rounded-2xl border-4 transition-transform ${
                          taken
                            ? "cursor-not-allowed opacity-30"
                            : color === c.hex
                              ? "scale-105 border-foreground"
                              : "border-transparent opacity-80"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {taken && (
                          <span className="absolute inset-0 flex items-center justify-center text-2xl text-foreground">
                            ✕
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {usedColors.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Une couleur déjà prise par une autre équipe ne peut plus être choisie.
                  </p>
                )}
              </div>
            </section>

            <button
              className="btn-huge"
              disabled={busy || code.length !== 4 || !name.trim()}
              onClick={join}
            >
              {busy ? "Connexion..." : "C'est parti !"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
