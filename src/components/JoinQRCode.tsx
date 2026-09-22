import { useEffect, useRef } from "react";
import QRCode from "qrcode";

type Props = {
  url: string;
  size?: number;
  label?: string;
};

/** Renders a scannable QR code pointing at the given URL. */
export function JoinQRCode({ url, size = 220, label = "QR code pour rejoindre la partie" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 1,
      color: { dark: "#0d1220", light: "#ffffff" },
    });
  }, [url, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="mx-auto rounded-xl"
      aria-label={label}
    />
  );
}
