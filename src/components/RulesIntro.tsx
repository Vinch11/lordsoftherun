import { Flag, MapPin, Shield, Star, Timer, X } from "lucide-react";
import {
  CLOSE_RADIUS_M,
  LANDMARK_CLAIM_RADIUS_M,
  MIN_LOOP_DISTANCE_M,
} from "@/lib/conquete";

type Props = {
  teamName?: string | null;
  teamColor?: string;
  hasReturnZone?: boolean;
  onClose: () => void;
  /** Close label; defaults to the pre-game wording. */
  closeLabel?: string;
};

const RULES = [
  {
    icon: Flag,
    title: "Lance ta boucle",
    text: "Appuie sur « Commencer ma boucle » à ton point de départ. Ta trace GPS s'affiche en direct dans la couleur de ton groupe.",
  },
  {
    icon: MapPin,
    title: "Referme la boucle",
    text: `Parcours au moins ${MIN_LOOP_DISTANCE_M} m puis reviens à moins de ${CLOSE_RADIUS_M} m de ton point de départ : la boucle se ferme toute seule et la surface enfermée devient votre territoire.`,
  },
  {
    icon: Shield,
    title: "Vole du terrain",
    text: "Si votre boucle recouvre le territoire d'un autre groupe, la zone commune change de camp. Le score, c'est la surface possédée en m².",
  },
  {
    icon: Star,
    title: "Bonus et zones interdites",
    text: `Passe à moins de ${LANDMARK_CLAIM_RADIUS_M} m d'un repère ⭐ pour empocher son bonus. Les zones rouges sont interdites : y entrer coûte des points.`,
  },
  {
    icon: Timer,
    title: "Consignes de sécurité",
    text: "Restez groupés, respectez le code de la route, traversez sur les passages piétons et gardez un œil sur la circulation plutôt que sur l'écran.",
  },
];

export function RulesIntro({
  teamName,
  teamColor = "#e63946",
  hasReturnZone,
  onClose,
  closeLabel = "C'est compris, on y va !",
}: Props) {
  return (
    <div className="absolute inset-0 z-[1200] flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="pill">
              <span
                className="h-3 w-3 rounded-full border-2 border-foreground"
                style={{ backgroundColor: teamColor }}
              />
              {teamName ?? "Votre groupe"}
            </div>
            <h1 className="mt-3 text-4xl leading-[0.9]">
              Règles du <em>jeu</em>
            </h1>
          </div>
          <button className="icon-btn" aria-label="Fermer les règles" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {RULES.map((rule) => (
            <div key={rule.title} className="panel flex gap-3 p-4">
              <rule.icon className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
              <div className="flex flex-col gap-1">
                <span className="text-base font-bold">{rule.title}</span>
                <span className="text-sm text-muted-foreground">{rule.text}</span>
              </div>
            </div>
          ))}
          {hasReturnZone && (
            <div className="panel flex gap-3 p-4 ring-2 ring-accent">
              <Flag className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
              <div className="flex flex-col gap-1">
                <span className="text-base font-bold">Zone de retour</span>
                <span className="text-sm text-muted-foreground">
                  À la fin du temps, votre groupe doit se trouver dans la zone de retour indiquée
                  sur la carte, sinon votre territoire n'est pas comptabilisé.
                </span>
              </div>
            </div>
          )}
        </div>

        <button className="btn-huge btn-huge-accent mt-auto" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
