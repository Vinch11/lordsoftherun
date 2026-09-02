import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Play, QrCode, ShieldCheck, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JoinQRCode } from "@/components/JoinQRCode";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/profile";
import { getTerminology } from "@/lib/terminology";
import { formatArea, getMyTeams, randomCode, rememberMyTeam, setMyTeams } from "@/lib/conquete";

type MyGame = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  created_at: string;
  teamCount: number;
  topTeam: string | null;
  topScore: number;
};

type ResumeTeam = { teamId: string; teamName: string; code: string; gameName: string | null };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conquête — Jeu de course GPS pour l'EPS" },
      {
        name: "description",
        content:
          "Conquête : un Paper.io grandeur nature. Les équipes courent dans les rues, ferment leurs boucles GPS et capturent du territoire en temps réel.",
      },
      { property: "og:title", content: "Conquête — Jeu de course GPS pour l'EPS" },
      {
        property: "og:description",
        content:
          "Créez une partie, partagez un code à 4 chiffres, et laissez les équipes conquérir le quartier à la course.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, refresh: refreshProfile } = useProfile(user?.id);
  const t = getTerminology(profile?.terminology);

  async function toggleTerminology() {
    if (!profile) return;
    const next = profile.terminology === "organisateur" ? "enseignant" : "organisateur";
    const { error } = await supabase
      .from("profiles")
      .update({ terminology: next })
      .eq("id", profile.id);
    if (error) {
      toast.error("Impossible de changer la terminologie.");
      return;
    }
    await refreshProfile();
  }
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [myGames, setMyGames] = useState<MyGame[]>([]);
  const [resumeTeams, setResumeTeams] = useState<ResumeTeam[]>([]);
  const [qrCodeGame, setQrCodeGame] = useState<string | null>(null);
  const [deletingGame, setDeletingGame] = useState<string | null>(null);

  useEffect(() => {
    // One-time migration: this device used to remember only the single most
    // recently joined team. Fold it into the new multi-team list so students
    // mid-game when this ships don't lose their resume shortcut.
    const legacyRaw = localStorage.getItem("conquete:last-team");
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as { teamId: string; code: string };
        rememberMyTeam(legacy.teamId, legacy.code);
      } catch {
        /* malformed legacy entry — nothing to migrate */
      }
      localStorage.removeItem("conquete:last-team");
    }

    const stored = getMyTeams();
    if (stored.length === 0) return;
    let active = true;
    void (async () => {
      const teamIds = stored.map((s) => s.teamId);
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name, game_id")
        .in("id", teamIds);
      const gameIds = [...new Set((teamRows ?? []).map((t) => t.game_id))];
      const { data: gameRows } =
        gameIds.length > 0
          ? await supabase.from("games").select("id, name, status, ends_at").in("id", gameIds)
          : { data: [] };
      if (!active) return;

      const gamesById = new Map((gameRows ?? []).map((g) => [g.id, g]));
      const nowMs = Date.now();
      // Only teams whose game is still running are worth remembering — once a
      // game ends there's nothing left to resume, so drop it from storage too
      // instead of re-fetching it forever.
      const kept: typeof stored = [];
      const resumeList: ResumeTeam[] = [];
      for (const entry of stored) {
        const team = teamRows?.find((tm) => tm.id === entry.teamId);
        if (!team) continue; // team deleted
        const game = gamesById.get(team.game_id);
        const finished =
          !game ||
          game.status === "finished" ||
          (game.ends_at != null && new Date(game.ends_at).getTime() <= nowMs);
        if (finished) continue;
        kept.push(entry);
        resumeList.push({
          teamId: team.id,
          teamName: team.name,
          code: entry.code,
          gameName: game.name,
        });
      }
      if (kept.length !== stored.length) setMyTeams(kept);
      setResumeTeams(resumeList);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setMyGames([]);
      return;
    }
    let active = true;
    void supabase
      .from("games")
      .select("id, code, name, status, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(async ({ data: games }) => {
        if (!active || !games) return;
        const ids = games.map((g) => g.id);
        const { data: teams } = ids.length
          ? await supabase.from("teams").select("game_id, name, score_m2").in("game_id", ids)
          : { data: [] };
        if (!active) return;
        setMyGames(
          games.map((g) => {
            const gameTeams = (teams ?? []).filter((t) => t.game_id === g.id);
            const top = gameTeams.reduce<(typeof gameTeams)[number] | null>(
              (best, t) => (!best || t.score_m2 > best.score_m2 ? t : best),
              null,
            );
            return {
              ...g,
              teamCount: gameTeams.length,
              topTeam: top?.name ?? null,
              topScore: top?.score_m2 ?? 0,
            };
          }),
        );
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function renameGame(game: MyGame) {
    const input = window.prompt(
      `Nom de la partie ${game.code} (laisser vide pour retirer le nom) :`,
      game.name ?? "",
    );
    if (input === null) return;
    const next = input.trim().slice(0, 80);
    const { error } = await supabase
      .from("games")
      .update({ name: next || null })
      .eq("id", game.id);
    if (error) {
      toast.error("Impossible de renommer cette partie.");
      return;
    }
    setMyGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, name: next || null } : g)));
    toast.success("Partie renommée.");
  }

  async function deleteGame(game: MyGame) {
    if (
      !window.confirm(
        `Supprimer définitivement la partie ${game.code} et toutes ses données (équipes, territoires, classement) ?`,
      )
    ) {
      return;
    }
    setDeletingGame(game.id);
    try {
      const { error } = await supabase.from("games").delete().eq("id", game.id);
      if (error) {
        toast.error("Impossible de supprimer cette partie.");
        return;
      }
      setMyGames((prev) => prev.filter((g) => g.id !== game.id));
      toast("Partie supprimée.");
    } finally {
      setDeletingGame(null);
    }
  }

  async function createGame() {
    if (!user) {
      await navigate({ to: "/auth" });
      return;
    }
    setCreating(true);
    try {
      for (let i = 0; i < 6; i++) {
        const c = randomCode();
        const { data, error } = await supabase
          .from("games")
          .insert({ code: c, owner_id: user.id })
          .select()
          .maybeSingle();
        if (!error && data) {
          await navigate({ to: "/prof/$code", params: { code: c } });
          return;
        }
      }
      toast.error("Impossible de créer la partie, réessayez.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <header className="pt-6">
          <div className="pill">
            <MapPin className="h-3.5 w-3.5" /> EPS · plein air
          </div>
          <h1 className="mt-4 text-6xl leading-[0.9]">
            Con
            <span className="text-primary">quête</span>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Courez, bouclez, capturez. Le dernier qui entoure une zone la remporte.
          </p>
        </header>

        {resumeTeams.length > 0 && (
          <div className="flex flex-col gap-2">
            {resumeTeams.length > 1 && <span className="section-title">Mes parties en cours</span>}
            {resumeTeams.map((rt) => (
              <button
                key={rt.teamId}
                className="btn-huge btn-huge-accent"
                onClick={() => navigate({ to: "/jouer/$teamId", params: { teamId: rt.teamId } })}
              >
                <Play className="h-5 w-5" /> Reprendre ma partie — {rt.teamName}
                {rt.gameName ? ` (${rt.gameName})` : ""}
              </button>
            ))}
          </div>
        )}

        <section className="panel flex flex-col gap-4 p-5">
          <div className="section-title">
            <Users className="h-4 w-4" /> Groupe d'élèves
          </div>
          <input
            className="field text-center text-3xl font-bold tracking-[0.4em]"
            inputMode="numeric"
            placeholder="0000"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <button
            className="btn-huge"
            disabled={code.length !== 4}
            onClick={() => navigate({ to: "/rejoindre/$code", params: { code } })}
          >
            Rejoindre la partie
          </button>
        </section>

        {user && myGames.length > 0 && (
          <section className="panel flex flex-col gap-1 p-5">
            <div className="section-title mb-2">Mes parties</div>
            {myGames.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 border-b border-border py-3 last:border-0"
              >
                <button
                  className="flex flex-1 flex-col gap-1 text-left"
                  onClick={() => navigate({ to: "/prof/$code", params: { code: g.code } })}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="display truncate text-xl tracking-[0.2em]">
                      {g.name ? <span className="tracking-normal">{g.name}</span> : g.code}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        g.status === "running"
                          ? "bg-accent text-accent-foreground"
                          : g.status === "finished"
                            ? "bg-muted text-muted-foreground"
                            : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {g.status === "running"
                        ? "En cours"
                        : g.status === "finished"
                          ? "Terminée"
                          : "Lobby"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {g.name && <span className="font-bold">#{g.code} · </span>}
                      {new Date(g.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {g.teamCount} équipe{g.teamCount > 1 ? "s" : ""}
                    </span>
                    {g.topTeam && (
                      <span>
                        🏆 {g.topTeam} · {formatArea(g.topScore)}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  aria-label={`Renommer la partie ${g.code}`}
                  className="icon-btn p-3"
                  onClick={() => void renameGame(g)}
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  aria-label={`Afficher le QR code de la partie ${g.code}`}
                  className="icon-btn p-3"
                  onClick={() => setQrCodeGame(g.code)}
                >
                  <QrCode className="h-5 w-5" />
                </button>

                <button
                  aria-label={`Supprimer la partie ${g.code}`}
                  className="icon-btn p-3 text-destructive"
                  disabled={deletingGame === g.id}
                  onClick={() => void deleteGame(g)}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </section>
        )}

        {qrCodeGame && (
          <div
            className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-6 bg-background p-6"
            onClick={() => setQrCodeGame(null)}
          >
            <JoinQRCode url={`${window.location.origin}/rejoindre/${qrCodeGame}`} size={320} />
            <div className="display text-5xl tracking-[0.3em]">{qrCodeGame}</div>
            <p className="text-muted-foreground">Touchez l'écran pour fermer</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 pt-4 text-center">
          {user ? (
            <>
              {profile?.role === "admin" && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1 text-sm font-semibold text-muted-foreground underline"
                >
                  <ShieldCheck className="h-4 w-4" /> Administration
                </Link>
              )}
              {profile && !profile.approved && profile.role !== "admin" ? (
                <p className="text-sm text-muted-foreground">{t.pendingApproval}</p>
              ) : (
                <button
                  className="text-sm font-semibold text-muted-foreground underline disabled:opacity-50"
                  disabled={creating || loading}
                  onClick={createGame}
                >
                  {creating ? "Création..." : t.createGameButton}
                </button>
              )}
              {profile && (
                <button
                  className="text-sm text-muted-foreground underline"
                  onClick={() => void toggleTerminology()}
                >
                  Utiliser le terme «{" "}
                  {profile.terminology === "organisateur" ? "enseignant" : "organisateur"} » plutôt
                  que « {t.roleNoun} »
                </button>
              )}
              <button
                className="text-sm text-muted-foreground underline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast("Déconnecté.");
                }}
              >
                Se déconnecter ({user.email})
              </button>
            </>
          ) : (
            <Link to="/auth" className="text-sm text-muted-foreground underline">
              Espace enseignant
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
