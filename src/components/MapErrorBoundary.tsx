import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Leaflet mutates the DOM directly inside the container React also owns via
 * a ref — if the two ever race (e.g. React re-rendering a sibling right as
 * Leaflet adds/removes a layer), React's next reconciliation can throw
 * "insertBefore: the node ... is not a child of this node", which previously
 * took the whole play screen down to the router's generic error page (losing
 * the GPS watch, timers, everything). Catching it here instead means only
 * the map itself needs a retry — the student keeps their game state scoring,
 * score strip, buttons.
 */
export class MapErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("Carte : erreur de rendu récupérée par la zone de sécurité.", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Carte indisponible</p>
          <button
            type="button"
            className="btn-huge-dark"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCw className="h-5 w-5" /> Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
