import { useState } from "react";
import { X } from "lucide-react";

type Platform = "android" | "ios";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "android";
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "android";
}

type Props = {
  onDismiss: () => void;
};

/**
 * Full-screen help shown when the browser reports PERMISSION_DENIED for
 * geolocation — the app is unusable without it, so a raw error string isn't
 * enough; walk the student through re-enabling it for their OS.
 */
export function GeoPermissionHelp({ onDismiss }: Props) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform());

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4">
      <div className="panel relative flex w-full max-w-sm flex-col gap-4 p-5">
        <button aria-label="Fermer" className="icon-btn absolute right-3 top-3" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </button>
        <div className="section-title">📍 Localisation refusée</div>
        <p className="text-sm text-muted-foreground">
          L'app a besoin de votre position GPS pour jouer. Réactivez-la dans les réglages de votre
          téléphone, puis rechargez la page.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="seg-btn"
            data-active={platform === "android"}
            onClick={() => setPlatform("android")}
          >
            Android
          </button>
          <button
            className="seg-btn"
            data-active={platform === "ios"}
            onClick={() => setPlatform("ios")}
          >
            iPhone
          </button>
        </div>
        {platform === "android" ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>Dans Chrome, touchez les ⋮ en haut à droite puis "Infos sur le site".</li>
            <li>Touchez "Position" et choisissez "Autoriser".</li>
            <li>Revenez ici et rechargez la page.</li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>
              Réglages → Confidentialité et sécurité → Service de localisation : vérifiez qu'il est
              activé.
            </li>
            <li>Toujours dans Réglages, descendez jusqu'à Safari → Position → "Autoriser".</li>
            <li>Revenez ici et rechargez la page.</li>
          </ol>
        )}
        <button className="btn-huge btn-huge-accent" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    </div>
  );
}
