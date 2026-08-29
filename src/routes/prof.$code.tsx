import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LogOut, MapPin, Minus, Plus, Send, Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { useGameState } from "@/lib/useGameState";
import { useSession } from "@/lib/useSession";
import { sendProfMessage, useMessages } from "@/lib/messages";
import { formatArea, formatClock, haversine } from "@/lib/conquete";

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

const DEFAULT_ZONE_RADIUS = 30;

function TeacherDashboard() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const [gameId, setGameId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [duration, setDuration] = useState(20);
  const [now, setNow] = useState(() => Date.now());
  const [placingZone, setPlacingZone] = useState(false);
  const [zoneRadius, setZoneRadius] = useState(DEFAULT_ZONE_RADIUS);
  const [messageBody, setMessageBody] = useState("");
  const [messageTarget, setMessageTarget] = useState<string>("all");
  const stoppedRef = useRef(false);
  const radiusInitRef = useRef(false);
  const seenMessageCount = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      void navigate({ to: "/connexion" });
    }
  }, [sessionLoading, session, navigate]);

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
  const { messages } = useMessages(gameId);

  useEffect(() => {
    if (!radiusInitRef.current && game?.return_radius_m != null) {
      setZoneRadius(game.return_radius_m);
      radiusInitRef.current = true;
    }
  }, [game?.return_radius_m]);

  useEffect(() => {
    if (seenMessageCount.current === null) {
      seenMessageCount.current = messages.length;
      return;
    }
    if (messages.length > seenMessageCount.current) {
      const latest = messages[messages.length - 1];
      if (latest?.from_role === "team") {
        const from = teams.find((t) => t.id === latest.from_team_id);
        toast(`💬 ${from?.name ?? "Équipe"} : ${latest.body}`);
      }
    }
    seenMessageCount.current = messages.length;
  }, [messages, teams]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isOwner = !game?.owner_id || (session && game.owner_id === session.user.id);

  const remaining = game?.ends_at ? (new Date(game.ends_at).getTime() - now) / 1000 : duration * 60;
  const running = game?.status === "running" && remaining > 0;

  const withinReturnZone = useMemo(() => {
    return (team: { lat: number | null; lng: number | null }) => {
      if (game?.return_lat == null || game.return_lng == null || game.return_radius_m == null) {
        return true;
      }
      if (team.lat == null || team.lng == null) return false;
      return (
        haversine([team.lat, team.lng], [game.return_lat, game.return_lng]) <= game.return_radius_m
      );
    };
  }, [game?.return_lat, game?.return_lng, game?.return_radius_m]);

  async function stop() {
    if (!gameId || stoppedRef.current) return;
    stoppedRef.current = true;
    await Promise.all(
      teams.map((t) =>
        supabase
          .from("teams")
          .update({ validated: withinReturnZone(t) })
          .eq("id", t.id),
      ),
    );
    await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
    toast("Partie terminée.");
  }

  useEffect(() => {
    if (game?.status === "running" && remaining <= 0) {
      void stop();
    }
    if (game?.status !== "running") {
      stoppedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, game?.status]);

  const ranked = useMemo(() => [...teams].sort((a, b) => b.score_m2 - a.score_m2), [teams]);
  const finished = game?.status === "finished";
  const validatedRanked = useMemo(() => ranked.filter((t) => t.validated), [ranked]);
  const unvalidated = useMemo(() => ranked.filter((t) => !t.validated), [ranked]);

  const center = useMemo<[number, number] | null>(() => {
    if (game?.return_lat != null && game.return_lng != null)
      return [game.return_lat, game.return_lng];
    const withPos = teams.filter((t) => t.lat != null && t.lng != null);
    if (!withPos.length) return null;
    const lat = withPos.reduce((s, t) => s + (t.lat ?? 0), 0) / withPos.length;
    const lng = withPos.reduce((s, t) => s + (t.lng ?? 0), 0) / withPos.length;
    return [lat, lng];
  }, [teams, game?.return_lat, game?.return_lng]);

  const mapTerritories = useMemo(
    () =>
      territories.map((t) => ({
        id: t.id,
        color: teams.find((x) => x.id === t.team_id)?.color ?? "#888888",
        geometry: t.geometry,
      })),
    [territories, teams],
  );

  const returnZone = useMemo(
    () =>
      game?.return_lat != null && game.return_lng != null && game.return_radius_m != null
        ? { lat: game.return_lat, lng: game.return_lng, radiusM: game.return_radius_m }
        : null,
    [game?.return_lat, game?.return_lng, game?.return_radius_m],
  );

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

  async function placeZone(lat: number, lng: number) {
    if (!gameId) return;
    await supabase
      .from("games")
      .update({ return_lat: lat, return_lng: lng, return_radius_m: zoneRadius })
      .eq("id", gameId);
    setPlacingZone(false);
    toast.success("Zone de retour placée.");
  }

  async function updateZoneRadius(next: number) {
    setZoneRadius(next);
    if (!gameId || game?.return_lat == null) return;
    await supabase.from("games").update({ return_radius_m: next }).eq("id", gameId);
  }

  async function clearZone() {
    if (!gameId) return;
    await supabase
      .from("games")
      .update({ return_lat: null, return_lng: null, return_radius_m: null })
      .eq("id", gameId);
  }

  async function sendMessage() {
    if (!gameId || !messageBody.trim()) return;
    const body = messageBody.trim();
    setMessageBody("");
    try {
      await sendProfMessage(gameId, body, messageTarget === "all" ? null : messageTarget);
    } catch {
      toast.error("Message non envoyé.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg">Aucune partie avec le code {code}.</p>
      </main>
    );
  }

  if (!sessionLoading && session && !isOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg">Cette partie ne vous appartient pas.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative h-[45vh] min-h-[280px] w-full">
        <MapCanvas
          center={center}
          teams={teams}
          territories={mapTerritories}
          returnZone={returnZone}
          onMapClick={placingZone ? placeZone : undefined}
        />
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
        <button
          className="panel pointer-events-auto absolute right-3 top-3 z-[1000] flex items-center gap-1 px-3 py-2 text-sm font-semibold"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
        {placingZone && (
          <div className="panel pointer-events-none absolute inset-x-3 bottom-3 z-[1000] px-4 py-3 text-center text-sm font-semibold">
            Touchez la carte pour placer le centre de la zone de retour
          </div>
        )}
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

        <section className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-4 w-4" /> Zone de retour
            </div>
            {returnZone && (
              <button
                aria-label="Supprimer la zone"
                className="rounded-xl bg-muted p-2"
                onClick={clearZone}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {returnZone ? (
            <p className="text-sm text-muted-foreground">
              Les équipes doivent être revenues dans cette zone quand le temps s'écoule pour que
              leur territoire compte au classement.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune zone définie : tous les territoires capturés comptent, quelle que soit la
              position finale des équipes.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Rayon</span>
            <div className="flex items-center gap-3">
              <button
                aria-label="Réduire le rayon"
                className="rounded-xl bg-muted p-2"
                onClick={() => void updateZoneRadius(Math.max(10, zoneRadius - 10))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="display w-16 text-center text-lg">{zoneRadius} m</span>
              <button
                aria-label="Augmenter le rayon"
                className="rounded-xl bg-muted p-2"
                onClick={() => void updateZoneRadius(Math.min(300, zoneRadius + 10))}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <button
            className={`btn-huge ${placingZone ? "btn-huge-accent" : "btn-huge-dark"}`}
            onClick={() => setPlacingZone((p) => !p)}
          >
            {placingZone
              ? "Touchez la carte..."
              : returnZone
                ? "Déplacer la zone"
                : "Placer sur la carte"}
          </button>
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
          {(finished ? validatedRanked : ranked).map((t, i) => (
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
          {finished && unvalidated.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Hors classement — pas revenues dans la zone à temps
              </span>
              {unvalidated.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 opacity-60">
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border-2 border-foreground"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="flex-1 truncate font-semibold">{t.name}</span>
                  <span className="display text-base tabular-nums line-through">
                    {formatArea(t.score_m2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel flex flex-col gap-3 p-4">
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Messages
          </div>
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">Aucun message.</p>
            )}
            {messages.map((m) => {
              const label =
                m.from_role === "prof"
                  ? m.to_team_id
                    ? `→ ${teams.find((t) => t.id === m.to_team_id)?.name ?? "équipe"}`
                    : "📢 À toutes les équipes"
                  : `${teams.find((t) => t.id === m.from_team_id)?.name ?? "Équipe"} →`;
              return (
                <div key={m.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <div>{m.body}</div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <select
              className="field"
              value={messageTarget}
              onChange={(e) => setMessageTarget(e.target.value)}
            >
              <option value="all">Toutes les équipes</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="Votre message..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
              />
              <button
                aria-label="Envoyer"
                className="rounded-xl bg-primary p-3 text-primary-foreground"
                onClick={sendMessage}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
