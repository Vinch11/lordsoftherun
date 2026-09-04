export type GameKind = "individuel" | "team";

type Props = {
  open: boolean;
  busy: boolean;
  onSelect: (kind: GameKind) => void;
  onClose: () => void;
};

/**
 * The first question when creating a game: one device per team (every mode,
 * as always) or several players sharing one team's score (Territoire and
 * Grille only, the two modes built for it). Decided once, up front, rather
 * than buried in a toggle discovered after the fact.
 */
export function GameKindDialog({ open, busy, onSelect, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-6 bg-background/95 p-6"
      onClick={onClose}
    >
      <div className="flex w-full max-w-sm flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="page-title text-4xl">
          Nouvelle <em>partie</em>
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect("individuel")}
          className="flex flex-col gap-1 rounded-2xl bg-secondary/60 px-5 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <span className="text-lg font-bold">Individuel</span>
          <span className="text-sm text-muted-foreground">
            Un appareil par équipe. Tous les modes : Territoire, Drapeau, Grille, Circuit.
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect("team")}
          className="flex flex-col gap-1 rounded-2xl bg-secondary/60 px-5 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <span className="text-lg font-bold">Match par équipe</span>
          <span className="text-sm text-muted-foreground">
            Plusieurs joueurs par équipe, même score. Territoire et Grille uniquement.
          </span>
        </button>
        <button
          type="button"
          className="text-center text-sm text-muted-foreground underline"
          onClick={onClose}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
