import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Play, QrCode, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JoinQRCode } from "@/components/JoinQRCode";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/profile";
import { formatArea, randomCode } from "@/lib/conquete";


type MyGame = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  teamCount: number;
  topTeam: string | null;
  topScore: number;
};

type ResumeTeam = { teamId: string; teamName: string; code: string };

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
  const { profile } = useProfile(user?.id);
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [myGames, setMyGames] = useState<MyGame[]>([]);
  const [resumeTeam, setResumeTeam] = useState<ResumeTeam | null>(null);
  const [qrCodeGame, setQrCodeGame] = useState<string | null>(null);


  useEffect(() => {
    const raw = localStorage.getItem("conquete:last-team");
    if (!raw) return;
    try {
      const last = JSON.parse(raw) as { teamId: string; code: string };
      void supabase
        .from("teams")
        .select("id, name")
        .eq("id", last.teamId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setResumeTeam({ teamId: data.id, teamName: data.name, code: last.code });
          else localStorage.removeItem("conquete:last-team");
        });
    } catch {
      localStorage.removeItem("conquete:last-team");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setMyGames([]);
      return;
    }
    let active = true;
    void supabase
      .from("games")
      .select("id, code, status, created_at")
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
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary-foreground">
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

        {resumeTeam && (
          <button
            className="btn-huge btn-huge-accent"
            onClick={() =>
              navigate({ to: "/jouer/$teamId", params: { teamId: resumeTeam.teamId } })
            }
          >
            <Play className="h-5 w-5" /> Reprendre ma partie — {resumeTeam.teamName}
          </button>
        )}

        <section className="panel flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
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
            <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Mes parties
            </div>
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
                    <span className="display text-xl tracking-[0.2em]">{g.code}</span>
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
                  aria-label={`Afficher le QR code de la partie ${g.code}`}
                  className="rounded-xl bg-muted p-3"
                  onClick={() => setQrCodeGame(g.code)}
                >
                  <QrCode className="h-5 w-5" />
                </button>
              </div>
            ))}

          </section>
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
                <p className="text-sm text-muted-foreground">
                  Compte enseignant en attente de validation par l'administrateur.
                </p>
              ) : (
                <button
                  className="text-sm font-semibold text-muted-foreground underline disabled:opacity-50"
                  disabled={creating || loading}
                  onClick={createGame}
                >
                  {creating ? "Création..." : "+ Créer une partie (enseignant)"}
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
