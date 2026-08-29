import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Flag, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { randomCode } from "@/lib/conquete";

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
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

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

        <section className="panel flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Flag className="h-4 w-4" /> Enseignant
          </div>
          <button
            className="btn-huge btn-huge-dark"
            disabled={creating || loading}
            onClick={createGame}
          >
            {creating ? "Création..." : user ? "Créer une partie" : "Se connecter pour créer"}
          </button>
          <p className="text-sm text-muted-foreground">
            {user
              ? "Vous obtiendrez un code à 4 chiffres à donner aux groupes."
              : "Créez votre compte enseignant (e-mail + mot de passe) pour lancer une partie."}
          </p>
          {user && (
            <button
              className="text-left text-sm font-semibold underline text-muted-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                toast("Déconnecté.");
              }}
            >
              Se déconnecter ({user.email})
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
