import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "conquete:pwa-banner-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari's own flag — non-standard, but the only signal it exposes.
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Nudges students to add the app to their home screen — mostly useful for a
 * "chacun chez soi" game spread over weeks, where reopening a pinned browser
 * tab every time is more friction than a one-tap home screen icon. iOS never
 * shows its own install prompt, hence the explicit instructions.
 */
export function InstallPwaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="panel flex items-start gap-3 px-4 py-3">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Ajoute l'app à ton écran d'accueil</p>
        <p className="text-xs text-muted-foreground">
          {isIOS()
            ? "Bouton Partager, puis « Sur l'écran d'accueil » — tu y accéderas en un tap la prochaine fois."
            : "Menu du navigateur → « Installer l'application » — tu y accéderas en un tap la prochaine fois."}
        </p>
      </div>
      <button
        type="button"
        aria-label="Fermer"
        className="icon-btn h-7 w-7 shrink-0"
        onClick={dismiss}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
