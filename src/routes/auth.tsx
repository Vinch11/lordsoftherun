import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Terminology } from "@/lib/terminology";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Espace enseignant — Conquête" },
      {
        name: "description",
        content:
          "Créez votre compte enseignant Conquête pour lancer des parties de course GPS avec vos classes.",
      },
      { property: "og:title", content: "Espace enseignant — Conquête" },
      {
        property: "og:description",
        content: "Connexion et inscription des enseignants pour organiser une partie Conquête.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terminology, setTerminology] = useState<Terminology>("enseignant");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").update({ terminology }).eq("id", data.user.id);
        }
        toast.success("Compte créé, bienvenue !");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connecté !");
      }
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'authentification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <Link to="/" className="nav-back" aria-label="Retour à l'accueil">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <header>
          <div className="pill">
            <Flag className="h-3.5 w-3.5" /> Enseignant
          </div>
          <h1 className="mt-4 text-5xl leading-[0.9]">
            {mode === "signup" ? "Créer un compte" : "Se connecter"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Votre compte vous permet de créer vos parties et d'en garder le contrôle.
          </p>
        </header>

        <form className="panel flex flex-col gap-4 p-5" onSubmit={submit}>
          {mode === "signup" && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Vous êtes...
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-xl py-3 text-sm font-bold ${
                    terminology === "enseignant" ? "bg-accent" : "bg-muted"
                  }`}
                  onClick={() => setTerminology("enseignant")}
                >
                  Enseignant
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl py-3 text-sm font-bold ${
                    terminology === "organisateur" ? "bg-accent" : "bg-muted"
                  }`}
                  onClick={() => setTerminology("organisateur")}
                >
                  Organisateur
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Change juste le vocabulaire utilisé dans l'appli (modifiable plus tard).
              </p>
            </div>
          )}
          <input
            className="field"
            type="email"
            required
            autoComplete="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-huge" type="submit" disabled={busy}>
            {busy ? "..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        <button
          className="text-center text-base font-semibold underline"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup"
            ? "J'ai déjà un compte — se connecter"
            : "Nouveau ? Créer un compte enseignant"}
        </button>
      </div>
    </main>
  );
}
