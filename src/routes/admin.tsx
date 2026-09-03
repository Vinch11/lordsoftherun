import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Gamepad2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type Profile } from "@/lib/profile";
import { GAME_MODE_LABELS, type GameMode } from "@/lib/conquete";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration — Conquête" }],
  }),
  component: AdminPage,
});

type AdminGame = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  mode: GameMode;
  created_at: string;
  owner_id: string | null;
  teamCount: number;
};

function AdminPage() {
  const navigate = useNavigate();
  const { account: user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const loading = authLoading || profileLoading;
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      void navigate({ to: "/" });
    }
  }, [loading, user, isAdmin, navigate]);

  async function refresh() {
    setLoadingTeachers(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setTeachers((data ?? []) as Profile[]);
    setLoadingTeachers(false);
  }

  async function refreshGames() {
    setLoadingGames(true);
    const { data: gameRows } = await supabase
      .from("games")
      .select("id, code, name, status, mode, created_at, owner_id")
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = (gameRows ?? []).map((g) => g.id);
    const { data: teamRows } = ids.length
      ? await supabase.from("teams").select("game_id").in("game_id", ids)
      : { data: [] };
    const countByGame = new Map<string, number>();
    for (const t of teamRows ?? []) {
      countByGame.set(t.game_id, (countByGame.get(t.game_id) ?? 0) + 1);
    }
    setGames(
      (gameRows ?? []).map((g) => ({
        ...g,
        mode: g.mode as GameMode,
        teamCount: countByGame.get(g.id) ?? 0,
      })),
    );
    setLoadingGames(false);
  }

  useEffect(() => {
    if (isAdmin) {
      void refresh();
      void refreshGames();
    }
  }, [isAdmin]);

  async function setApproved(id: string, approved: boolean) {
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
    if (error) {
      toast.error("Action impossible.");
      return;
    }
    toast.success(approved ? "Compte approuvé." : "Accès révoqué.");
    void refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <p className="text-muted-foreground">Chargement…</p>
      </main>
    );
  }
  if (!isAdmin) return null;

  const pending = teachers.filter((t) => t.role === "teacher" && !t.approved);
  const approved = teachers.filter((t) => t.role === "teacher" && t.approved);
  const emailById = new Map(teachers.map((t) => [t.id, t.email]));
  const runningCount = games.filter((g) => g.status === "running").length;

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="nav-back" aria-label="Retour à l'accueil">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-2 text-3xl">
            <ShieldCheck className="h-7 w-7" /> Admin
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="stat">
            <span className="label-xs">Comptes</span>
            <span className="stat-value">{approved.length + pending.length}</span>
          </div>
          <div className="stat">
            <span className="label-xs">En attente</span>
            <span className="stat-value">{pending.length}</span>
          </div>
          <div className="stat">
            <span className="label-xs">Parties (50 dern.)</span>
            <span className="stat-value">{games.length}</span>
          </div>
          <div className="stat">
            <span className="label-xs">En cours</span>
            <span className="stat-value">{runningCount}</span>
          </div>
        </div>

        <section className="panel flex flex-col gap-1 p-4">
          <div className="section-title mb-2">En attente d'approbation ({pending.length})</div>
          {loadingTeachers && <p className="text-muted-foreground">Chargement…</p>}
          {!loadingTeachers && pending.length === 0 && (
            <p className="py-2 text-center text-muted-foreground">Aucune demande en attente.</p>
          )}
          {pending.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
            >
              <span className="flex-1 truncate text-sm">{t.email}</span>
              <button
                className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                onClick={() => void setApproved(t.id, true)}
              >
                Approuver
              </button>
            </div>
          ))}
        </section>

        <section className="panel flex flex-col gap-1 p-4">
          <div className="section-title mb-2">Comptes approuvés ({approved.length})</div>
          {approved.length === 0 && (
            <p className="py-2 text-center text-muted-foreground">Aucun pour l'instant.</p>
          )}
          {approved.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
            >
              <span className="flex-1 truncate text-sm">{t.email}</span>
              <button
                className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground"
                onClick={() => void setApproved(t.id, false)}
              >
                Révoquer
              </button>
            </div>
          ))}
        </section>

        <section className="panel flex flex-col gap-1 p-4">
          <div className="section-title mb-2">
            <Gamepad2 className="h-4 w-4" /> Parties récentes
          </div>
          {loadingGames && <p className="text-muted-foreground">Chargement…</p>}
          {!loadingGames && games.length === 0 && (
            <p className="py-2 text-center text-muted-foreground">Aucune partie créée.</p>
          )}
          {games.map((g) => (
            <Link
              key={g.id}
              to="/prof/$code"
              params={{ code: g.code }}
              className="flex items-center gap-3 border-b border-border py-3 last:border-0"
            >
              <span
                className={`chip shrink-0 ${g.status === "running" ? "chip-accent" : g.status === "finished" ? "chip-muted" : ""}`}
              >
                {g.status === "running"
                  ? "En cours"
                  : g.status === "finished"
                    ? "Terminée"
                    : "Lobby"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {g.name || `Partie ${g.code}`}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{g.code}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {GAME_MODE_LABELS[g.mode] ?? g.mode} · {g.teamCount} équipe
                  {g.teamCount > 1 ? "s" : ""} ·{" "}
                  {(g.owner_id && emailById.get(g.owner_id)) || "compte supprimé"}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(g.created_at).toLocaleDateString("fr-FR")}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
