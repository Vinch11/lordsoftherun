import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_COLORS, teamStorageKey } from "@/lib/conquete";

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
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([]);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    let active = true;
    const storedTeamId = localStorage.getItem(teamStorageKey(code));
    if (!storedTeamId) {
      setCheckingResume(false);
      return;
    }
    void supabase
      .from("teams")
      .select("id")
      .eq("id", storedTeamId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) {
          localStorage.setItem("conquete:last-team", JSON.stringify({ teamId: data.id, code }));
          void navigate({ to: "/jouer/$teamId", params: { teamId: data.id }, replace: true });
        } else {
          localStorage.removeItem(teamStorageKey(code));
          setCheckingResume(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
      .select("id")
      .eq("code", code)
      .maybeSingle()
      .then(async ({ data: game }) => {
        if (!game) {
          if (active) setExistingTeams([]);
          return;
        }
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, color")
          .eq("game_id", game.id)
          .order("created_at");
        if (active) setExistingTeams(teams ?? []);
      });
    return () => {
      active = false;
    };
  }, [code]);

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
            <button
              type="button"
              className="text-center text-sm text-muted-foreground underline"
              onClick={() => setCreatingNew(true)}
            >
              Créer une nouvelle équipe à la place
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
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={c.name}
                      onClick={() => setColor(c.hex)}
                      className={`h-16 rounded-2xl border-4 transition-transform ${
                        color === c.hex
                          ? "scale-105 border-foreground"
                          : "border-transparent opacity-80"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
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
