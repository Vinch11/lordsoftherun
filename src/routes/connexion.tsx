import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [{ title: "Espace enseignant — Conquête" }],
  }),
  component: TeacherAuth,
});

function TeacherAuth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      toast.error("Email requis et mot de passe d'au moins 6 caractères.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error("Email ou mot de passe incorrect.");
          return;
        }
        toast.success("Connecté !");
        await navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(error.message || "Impossible de créer le compte.");
          return;
        }
        if (!data.session) {
          toast.success("Compte créé ! Vérifiez votre email pour confirmer, puis connectez-vous.");
          setMode("login");
          return;
        }
        toast.success("Compte créé et connecté !");
        await navigate({ to: "/" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="pt-4 text-4xl">Espace enseignant</h1>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`btn-huge ${mode === "login" ? "btn-huge-accent" : "btn-huge-dark"}`}
            onClick={() => setMode("login")}
          >
            <LogIn className="h-5 w-5" /> Se connecter
          </button>
          <button
            type="button"
            className={`btn-huge ${mode === "signup" ? "btn-huge-accent" : "btn-huge-dark"}`}
            onClick={() => setMode("signup")}
          >
            <UserPlus className="h-5 w-5" /> Créer un compte
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Email
          </span>
          <input
            className="field"
            type="email"
            autoComplete="email"
            placeholder="prof@ecole.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Mot de passe
          </span>
          <input
            className="field"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
        </label>

        <button className="btn-huge" disabled={busy} onClick={submit}>
          {busy ? "Patientez..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </div>
    </main>
  );
}
