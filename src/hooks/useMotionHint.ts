import { useEffect, useRef, useState } from "react";

type MotionPermissionApi = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Best-effort "is the player currently moving briskly" signal from the
 * accelerometer, used only to help the GPS smoothing filter react faster
 * while running (see geoFilter.ts). Purely additive: the returned ref
 * defaults to false (the filter just assumes walking pace) wherever
 * DeviceMotion is unsupported or unavailable. Exposed as a ref rather than
 * state since motion events can fire dozens of times a second — nothing
 * needs a re-render for every tick, only `onPosition` reading the latest
 * value on each (much rarer) GPS fix.
 *
 * iOS requires an explicit user gesture to grant motion access, so
 * `needsPermission` flags that case for the caller to show a button; on
 * every other platform this starts listening immediately, no UI needed.
 */
export function useMotionHint() {
  const movingRef = useRef(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (typeof DeviceMotionEvent === "undefined") return;
    const requestPermission = (DeviceMotionEvent as unknown as MotionPermissionApi)
      .requestPermission;
    if (typeof requestPermission === "function") {
      setNeedsPermission(true);
    } else {
      setGranted(true);
    }
  }, []);

  useEffect(() => {
    if (!granted || typeof DeviceMotionEvent === "undefined") return;
    function handleMotion(e: DeviceMotionEvent) {
      const a = e.acceleration;
      if (!a) return;
      const magnitude = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      movingRef.current = magnitude > 1.5;
    }
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [granted]);

  async function requestPermission() {
    const requestPermission = (DeviceMotionEvent as unknown as MotionPermissionApi)
      .requestPermission;
    if (typeof requestPermission !== "function") return;
    try {
      const state = await requestPermission();
      if (state === "granted") {
        setGranted(true);
        setNeedsPermission(false);
      }
    } catch {
      // Denied or unsupported: the filter keeps working on GPS alone.
    }
  }

  return { movingRef, needsPermission, requestPermission };
}
