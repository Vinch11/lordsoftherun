import { studentThemeClass, type StudentTheme } from "@/lib/conquete";

/** Miniature de l'écran élève (carte + HUD + bouton) pour prévisualiser un thème. */
export function StudentThemePreview({ theme }: { theme: StudentTheme }) {
  return (
    <div
      className={`${studentThemeClass(theme)} relative h-40 w-full overflow-hidden rounded-xl`}
      aria-hidden
    >
      {/* Fausse carte */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(120,130,140,0.18)_0_10px,rgba(120,130,140,0.06)_10px_20px)]" />
      <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(57,255,136,0.35)]" />

      {/* HUD scores */}
      <div className="absolute inset-x-0 top-0 flex gap-1.5 p-2">
        <div className="score-chip score-chip-leader flex-1 px-2 py-1 text-[9px] leading-tight">
          <div className="label-xs font-bold">Bleus</div>
          <div className="display text-[13px] font-black">1 240</div>
        </div>
        <div className="score-chip flex-1 px-2 py-1 text-[9px] leading-tight">
          <div className="label-xs font-bold">Rouges</div>
          <div className="display text-[13px] font-black">890</div>
        </div>
      </div>

      {/* Bouton principal */}
      <div className="absolute inset-x-0 bottom-0 p-2">
        <div className="panel mb-1.5 px-2 py-1 text-[9px]">Prof : regroupement zone Nord !</div>
        <div className="btn-huge btn-huge-accent w-full text-center text-[12px]">
          Commencer ma boucle
        </div>
      </div>
    </div>
  );
}
