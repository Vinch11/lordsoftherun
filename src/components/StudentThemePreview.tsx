import { studentThemeClass } from "@/lib/conquete";

/**
 * Miniature mock-up of the student screen (map + floating HUD + action button)
 * rendered with a given skin, so the teacher can see each theme before picking it.
 */
export function StudentThemePreview({ theme, height = 190 }: { theme: string; height?: number }) {
  return (
    <div
      className={`bib ${studentThemeClass(theme)} relative w-full overflow-hidden rounded-xl`}
      style={{ height }}
    >
      {/* fake map */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #dfe7e2 0%, #eef2ee 45%, #e3e9f1 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(#b9c4bd 1px, transparent 1px), linear-gradient(90deg, #b9c4bd 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="absolute left-4 top-12 h-16 w-24 rotate-6 rounded-md"
          style={{ background: "rgba(57,255,136,.45)", border: "2px solid rgba(31,41,51,.55)" }}
        />
        <div
          className="absolute bottom-16 right-5 h-14 w-20 -rotate-3 rounded-md"
          style={{ background: "rgba(15,52,96,.35)", border: "2px solid rgba(31,41,51,.55)" }}
        />
      </div>

      {/* HUD */}
      <div className="absolute inset-x-2 top-2 flex gap-1.5">
        <div className="score-chip score-chip-me flex-1 px-2 py-1 text-[10px] leading-tight">
          <div className="label-xs">Mon équipe</div>
          <div className="font-bold">1 240 m²</div>
        </div>
        <div className="score-chip flex-1 px-2 py-1 text-[10px] leading-tight">
          <div className="label-xs">Rouges</div>
          <div className="font-bold">890 m²</div>
        </div>
      </div>

      {/* bottom action */}
      <div className="absolute inset-x-2 bottom-2 flex flex-col gap-1.5">
        <div className="panel px-2 py-1 text-[10px]">
          <span className="label-xs">Distance</span> <span className="font-bold">320 m</span>
        </div>
        <div className="btn-huge btn-huge-accent w-full py-2 text-center text-[11px]">
          Commencer ma boucle
        </div>
      </div>
    </div>
  );
}
