/** Ask the browser, once, for permission to show OS-level notifications. */
export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

/** Short synthesized beep so a message is noticed even without looking at the screen. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio not available, notification/toast still gets the message across */
  }
}

/**
 * Alerts the user a message arrived: always a chime, plus an OS notification
 * when the tab is in the background and permission was granted (no server or
 * service worker involved — this only fires while the tab stays open).
 */
export function notifyMessage(title: string, body: string) {
  playChime();
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    typeof document !== "undefined" &&
    document.hidden
  ) {
    new Notification(title, { body });
  }
}
