import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type Profile } from "@/lib/profile";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration — Conquête" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const loading = authLoading || profileLoading;
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
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

  useEffect(() => {
    if (isAdmin) void refresh();
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

  if (!isAdmin) return null;

  const pending = teachers.filter((t) => t.role === "teacher" && !t.approved);
  const approved = teachers.filter((t) => t.role === "teacher" && t.approved);

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="nav-back" aria-label="Retour à l'accueil">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-2 text-3xl">
            <ShieldCheck className="h-7 w-7" /> Admin
          </h1>
        </div>

        <section className="panel flex flex-col gap-1 p-4">
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            En attente d'approbation ({pending.length})
          </div>
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
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Enseignants approuvés ({approved.length})
          </div>
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
      </div>
    </main>
  );
}
