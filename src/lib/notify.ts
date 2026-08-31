/** Ask the browser, once, for permission to show OS-level notifications. */
export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Unlocks audio on the first user gesture. Mobile browsers refuse to play
 * sound from a background event unless the page already played something
 * after a tap, so we prime a silent buffer as soon as the player interacts.
 */
export function primeAlertSound() {
  const c = audioCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.05);
}

/**
 * Wires `primeAlertSound` to every plausible first-interaction event —
 * browsers vary on exactly which gesture counts as "trusted" for unlocking
 * audio, so this doesn't gamble on a single event type or a single attempt
 * (each call is nearly free, and re-priming an already-unlocked context is
 * a no-op). Call once per screen; returns the cleanup for that effect.
 */
export function armAlertSound(): () => void {
  const events = ["pointerdown", "touchend", "keydown"] as const;
  const prime = () => primeAlertSound();
  for (const ev of events) window.addEventListener(ev, prime);
  return () => {
    for (const ev of events) window.removeEventListener(ev, prime);
  };
}

/** One loud siren-like tone. */
function tone(c: AudioContext, startAt: number, freqFrom: number, freqTo: number, dur: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freqFrom, startAt);
  osc.frequency.linearRampToValueAtTime(freqTo, startAt + dur);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.9, startAt + 0.02);
  gain.gain.setValueAtTime(0.9, startAt + dur - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/**
 * Loud alert designed to be heard outdoors while running: a rising
 * three-note siren at full gain, repeated for urgent alerts.
 */
function playAlarm(urgent: boolean) {
  const c = audioCtx();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  const pattern = urgent ? [0, 0.4, 0.8, 1.4, 1.8] : [0, 0.35, 0.7];
  pattern.forEach((offset, i) => {
    tone(c, t0 + offset, i % 2 === 0 ? 740 : 1180, i % 2 === 0 ? 1180 : 740, 0.3);
  });
}

function vibrate(urgent: boolean) {
  try {
    navigator.vibrate?.(urgent ? [300, 120, 300, 120, 600] : [200, 100, 200]);
  } catch {
    /* vibration unsupported — sound and toast still carry the message */
  }
}

/**
 * Alerts the user something happened: a loud siren plus vibration every time,
 * and an OS notification whenever permission was granted (kept on screen for
 * urgent alerts so it isn't missed while the phone is in a pocket).
 */
export function notifyMessage(title: string, body: string, urgent = false) {
  playAlarm(urgent);
  vibrate(urgent);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        tag: title,
        requireInteraction: urgent,
        silent: false,
      });
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }
}

/** Highest-priority alert (photo demandée, fin de partie, territoire perdu). */
export function notifyUrgent(title: string, body: string) {
  notifyMessage(title, body, true);
}
