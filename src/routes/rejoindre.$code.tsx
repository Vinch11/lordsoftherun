import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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

function Join() {
  const navigate = useNavigate();
  const { code: initialCode } = Route.useParams();
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 4));
  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]!.hex);
  const [busy, setBusy] = useState(false);
  const [checkingResume, setCheckingResume] = useState(true);

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

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="pt-4 text-4xl">Rejoindre</h1>

        <label className="flex flex-col gap-2">
          <span className="section-title">
            Code de la partie
          </span>
          <input
            className="field text-center text-3xl font-bold tracking-[0.4em]"
            inputMode="numeric"
            placeholder="0000"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="section-title">
            Nom de l'équipe
          </span>
          <input
            className="field"
            placeholder="Les Guépards"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="section-title">
            Couleur
          </span>
          <div className="grid grid-cols-4 gap-3">
            {TEAM_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                onClick={() => setColor(c.hex)}
                className={`h-16 rounded-2xl border-4 transition-transform ${
                  color === c.hex ? "scale-105 border-foreground" : "border-transparent opacity-80"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        <button
          className="btn-huge"
          disabled={busy || code.length !== 4 || !name.trim()}
          onClick={join}
        >
          {busy ? "Connexion..." : "C'est parti !"}
        </button>
      </div>
    </main>
  );
}
