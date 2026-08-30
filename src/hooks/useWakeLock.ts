import { useEffect, useRef } from "react";

/**
 * Keeps the screen on while `active` is true, so players don't have to keep
 * tapping their phone to stop it from locking (which would pause the GPS
 * watch entirely). Silently does nothing where unsupported (e.g. iOS < 16.4).
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    async function requestLock() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // Permission denied, battery saver, or unsupported: fail silently,
        // the game still works, players just need to keep the screen on.
      }
    }

    void requestLock();

    // The OS releases the lock whenever the tab is hidden (app switch,
    // screen off); re-acquire it as soon as the player comes back.
    function handleVisibility() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        void requestLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
}
