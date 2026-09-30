import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { GameReportDocument, PAGE_W, PAGE_H } from "@/components/GameReportDocument";
import type { GameReportData } from "@/lib/gameReport";

/**
 * Renders the report off-screen at full fidelity (so it looks the same
 * regardless of the current UI theme), rasterizes each page with
 * html2canvas-pro (the "-pro" fork handles the app's oklch() CSS variables,
 * which the ambient stylesheet uses everywhere and the standard html2canvas
 * can't parse), then assembles a multi-page PDF at those exact page
 * dimensions so the retina-scale capture is downsampled to normal size.
 */
export async function exportGameReportPdf(data: GameReportData, filename: string): Promise<void> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    flushSync(() => {
      root.render(<GameReportDocument data={data} />);
    });
    await document.fonts.ready;

    const pageEls = Array.from(container.querySelectorAll<HTMLElement>("[data-report-page]"));
    if (pageEls.length === 0) throw new Error("Aucune page de rapport à exporter.");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [PAGE_W, PAGE_H],
      hotfixes: ["px_scaling"],
      compress: true,
    });

    for (let i = 0; i < pageEls.length; i++) {
      const canvas = await html2canvas(pageEls[i]!, {
        scale: 2,
        backgroundColor: null,
        logging: false,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage([PAGE_W, PAGE_H], "portrait");
      pdf.addImage(img, "JPEG", 0, 0, PAGE_W, PAGE_H);
    }

    pdf.save(filename);
  } finally {
    root.unmount();
    container.remove();
  }
}
