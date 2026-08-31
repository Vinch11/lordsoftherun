import { useEffect } from "react";
import { CIRCUIT_ITEM_ICONS, CIRCUIT_ITEM_LABELS, type CircuitItemKind } from "@/lib/conquete";

type Props = {
  kind: CircuitItemKind;
  detail: string;
  onClose: () => void;
};

const KIND_TONE: Record<CircuitItemKind, string> = {
  shield: "text-accent",
  boost: "text-primary",
  banana: "text-[#e9c500]",
  lightning: "text-destructive",
};

/** Impossible-to-miss full-screen flash for a mystery box / banana / shield
 * result — the sound (notifyUrgent, played by the caller) carries the
 * "something happened" alert, this carries "what exactly happened". */
export function ItemResultOverlay({ kind, detail, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2100] flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className={`text-7xl ${KIND_TONE[kind]}`}>{CIRCUIT_ITEM_ICONS[kind]}</div>
      <div className="display text-3xl">{CIRCUIT_ITEM_LABELS[kind]}</div>
      <div className={`display text-xl ${KIND_TONE[kind]}`}>{detail}</div>
    </div>
  );
}
