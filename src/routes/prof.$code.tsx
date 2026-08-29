import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { useGameState } from "@/lib/useGameState";
import { formatArea, formatClock } from "@/lib/conquete";

export const Route = createFileRoute("/prof/$code")({
  head: () => ({
    meta: [
      { title: "Tableau de bord enseignant — Conquête" },
      {
        name: "description",
        content:
          "Suivez en direct la position de tous les groupes, les territoires capturés et le classement par surface.",
      },
      { property: "og:title", content: "Tableau de bord enseignant — Conquête" },
      {
        property: "og:description",
        content: "Positions en direct, territoires et scores de la partie Conquête.",
      },
    ],
  }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { code } = Route.useParams();
  const [gameId, setGameId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [duration, setDuration] = useState(20);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void supabase
      .from("games")
      .select("id, duration_minutes")
      .eq("code", code)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) setNotFound(true);
        else {
          setGameId(data.id);
          setDuration(data.duration_minutes);
        }
      });
    return () => {
      active = false;
    };
  }, [code]);

  const { game, teams, territories } = useGameState(gameId);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ranked = useMemo(
    () => [...teams].sort((a, b) => b.score_m2 - a.score_m2),
    [teams],
  );

  const center = useMemo<[number, number] | null>(() => {
    const withPos = teams.filter((t) => t.lat != null && t.lng != null);
    if (!withPos.length) return null;
    const lat = withPos.reduce((s, t) => s + (t.lat ?? 0), 0) / withPos.length;
    const lng = withPos.reduce((s, t) => s + (t.lng ?? 0), 0) / withPos.length;
    return [lat, lng];
  }, [teams]);

  const mapTerritories = useMemo(
    () =>
      territories.map((t) => ({
        id: t.id,
        color: teams.find((x) => x.id === t.team_id)?.color ?? "#888888",
        geometry: t.geometry,
      })),
    [territories, teams],
  );

  const remaining = game?.ends_at
    ? (new Date(game.ends_at).getTime() - now) / 1000
    : duration * 60;

  async function start() {
    if (!gameId) return;
    const ends = new Date(Date.now() + duration * 60_000).toISOString();
    await supabase
      .from("games")
      .update({
        status: "running",
        duration_minutes: duration,
        started_at: new Date().toISOString(),
        ends_at: ends,
      })
      .eq("id", gameId);
    toast.success("Partie démarrée !");
  }

  async function stop() {
    if (!gameId) return;
    await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
    toast("Partie terminée.");
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg">Aucune partie avec le code {code}.</p>
      </main>
    );
  }

  const running = game?.status === "running" && remaining > 0;

  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative h-[45vh] min-h-[280px] w-full">
        <MapCanvas center={center} teams={teams} territories={mapTerritories} />
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex items-center gap-2">
          <div className="panel px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Code
            </div>
            <div className="display text-2xl tracking-[0.3em]">{code}</div>
          </div>
          <div className="panel px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Temps
            </div>
            <div className="display text-2xl tabular-nums">{formatClock(remaining)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-4">
        <section className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Minuteur
            </span>
            <div className="flex items-center gap-3">
              <button
                aria-label="Réduire"
                className="rounded-xl bg-muted p-2"
                onClick={() => setDuration((d) => Math.max(5, d - 5))}
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="display w-20 text-center text-2xl">{duration} min</span>
              <button
                aria-label="Augmenter"
                className="rounded-xl bg-muted p-2"
                onClick={() => setDuration((d) => Math.min(120, d + 5))}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-huge btn-huge-accent" onClick={start}>
              {running ? "Relancer" : "Démarrer"}
            </button>
            <button className="btn-huge" onClick={stop}>
              Terminer
            </button>
          </div>
        </section>

        <section className="panel flex flex-col gap-1 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4" /> Classement ({teams.length} groupes)
          </div>
          {ranked.length === 0 && (
            <p className="py-4 text-center text-muted-foreground">
              En attente des groupes… Donnez le code {code}.
            </p>
          )}
          {ranked.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3 border-b border-border py-3 last:border-0"
            >
              <span className="display w-6 text-xl text-muted-foreground">{i + 1}</span>
              <span
                className="h-6 w-6 shrink-0 rounded-full border-2 border-foreground"
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 truncate text-lg font-semibold">{t.name}</span>
              <span className="display text-xl tabular-nums">{formatArea(t.score_m2)}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
