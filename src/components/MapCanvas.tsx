import { Suspense, lazy, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type GameMapType from "./GameMap";

const GameMap = lazy(() => import("./GameMap"));

type Props = ComponentProps<typeof GameMapType>;

export function MapCanvas(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-full w-full bg-muted" aria-hidden />;
  }

  return (
    <Suspense fallback={<div className="h-full w-full bg-muted" aria-hidden />}>
      <GameMap {...props} />
    </Suspense>
  );
}
