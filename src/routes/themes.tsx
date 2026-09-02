import { createFileRoute } from "@tanstack/react-router";
import { StudentThemePreview } from "@/components/StudentThemePreview";
import { STUDENT_THEMES } from "@/lib/conquete";

export const Route = createFileRoute("/themes")({
  head: () => ({
    meta: [
      { title: "Thèmes de l'écran élève — Conquête" },
      {
        name: "description",
        content:
          "Aperçu des thèmes visuels disponibles pour l'écran des élèves dans Conquête : dossard, frost, cristal, verre dépoli et néo futuriste.",
      },
      { property: "og:title", content: "Thèmes de l'écran élève — Conquête" },
      {
        property: "og:description",
        content: "Comparez les cinq thèmes visuels de l'écran élève de Conquête.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThemesPage,
});

function ThemesPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-bold">Thèmes de l'écran élève</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Voici à quoi ressemble l'écran de jeu des élèves avec chaque thème. Le choix se fait dans
        les réglages de la partie.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STUDENT_THEMES.map((th) => (
          <section key={th.id} className="flex flex-col gap-2">
            <StudentThemePreview theme={th.id} height={420} />
            <h2 className="text-base font-semibold">{th.label}</h2>
            <p className="text-sm text-muted-foreground">{th.hint}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
