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

export type NotificationSoundId =
  "discreet" | "double_beep" | "siren" | "long_alert" | "chime" | "intense";

export const DEFAULT_NOTIFICATION_SOUND: NotificationSoundId = "siren";

export const NOTIFICATION_SOUND_OPTIONS: {
  id: NotificationSoundId;
  label: string;
  description: string;
}[] = [
  { id: "discreet", label: "Discret", description: "Un seul bip doux et bref." },
  { id: "double_beep", label: "Bip double", description: "Deux bips brefs, un peu plus présents." },
  { id: "chime", label: "Carillon", description: "Trois notes claires, façon clochette." },
  { id: "siren", label: "Sirène", description: "La sirène montante par défaut." },
  {
    id: "long_alert",
    label: "Alerte longue",
    description: "Une séquence plus longue, difficile à manquer.",
  },
  {
    id: "intense",
    label: "Alarme intense",
    description: "Le son le plus fort et le plus insistant.",
  },
];

type ToneSpec = { offset: number; freqFrom: number; freqTo: number; dur: number };
type SoundPreset = { type: OscillatorType; peakGain: number; tones: ToneSpec[] };

const SOUND_PRESETS: Record<NotificationSoundId, SoundPreset> = {
  discreet: {
    type: "sine",
    peakGain: 0.35,
    tones: [{ offset: 0, freqFrom: 880, freqTo: 880, dur: 0.16 }],
  },
  double_beep: {
    type: "sine",
    peakGain: 0.5,
    tones: [
      { offset: 0, freqFrom: 700, freqTo: 700, dur: 0.12 },
      { offset: 0.18, freqFrom: 700, freqTo: 700, dur: 0.12 },
    ],
  },
  chime: {
    type: "sine",
    peakGain: 0.6,
    tones: [
      { offset: 0, freqFrom: 523, freqTo: 523, dur: 0.25 },
      { offset: 0.3, freqFrom: 659, freqTo: 659, dur: 0.25 },
      { offset: 0.6, freqFrom: 784, freqTo: 784, dur: 0.45 },
    ],
  },
  siren: {
    type: "square",
    peakGain: 0.9,
    tones: [
      { offset: 0, freqFrom: 740, freqTo: 1180, dur: 0.3 },
      { offset: 0.35, freqFrom: 1180, freqTo: 740, dur: 0.3 },
      { offset: 0.7, freqFrom: 740, freqTo: 1180, dur: 0.3 },
    ],
  },
  long_alert: {
    type: "square",
    peakGain: 0.9,
    tones: [
      { offset: 0, freqFrom: 740, freqTo: 1180, dur: 0.3 },
      { offset: 0.4, freqFrom: 1180, freqTo: 740, dur: 0.3 },
      { offset: 0.8, freqFrom: 740, freqTo: 1180, dur: 0.3 },
      { offset: 1.4, freqFrom: 1180, freqTo: 740, dur: 0.3 },
      { offset: 1.8, freqFrom: 740, freqTo: 1180, dur: 0.3 },
    ],
  },
  intense: {
    type: "square",
    peakGain: 1,
    tones: [
      { offset: 0, freqFrom: 740, freqTo: 1180, dur: 0.25 },
      { offset: 0.3, freqFrom: 1180, freqTo: 740, dur: 0.25 },
      { offset: 0.6, freqFrom: 740, freqTo: 1180, dur: 0.25 },
      { offset: 0.9, freqFrom: 1180, freqTo: 740, dur: 0.25 },
      { offset: 1.2, freqFrom: 740, freqTo: 1180, dur: 0.25 },
      { offset: 1.5, freqFrom: 1180, freqTo: 740, dur: 0.25 },
    ],
  },
};

function resolvePreset(id: NotificationSoundId | null | undefined): SoundPreset {
  return (id && SOUND_PRESETS[id]) || SOUND_PRESETS[DEFAULT_NOTIFICATION_SOUND];
}

/** One tone within a sound preset's sequence. */
function tone(
  c: AudioContext,
  startAt: number,
  { freqFrom, freqTo, dur }: ToneSpec,
  type: OscillatorType,
  peakGain: number,
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, startAt);
  osc.frequency.linearRampToValueAtTime(freqTo, startAt + dur);
  const attack = Math.min(0.02, dur / 4);
  const release = Math.min(0.05, dur / 4);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + attack);
  gain.gain.setValueAtTime(peakGain, startAt + dur - release);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/**
 * Plays a chosen sound preset outright — used both by real alerts and by the
 * prof's "test this sound" button (a direct click, so no priming needed).
 */
export function previewSound(id: NotificationSoundId) {
  const c = audioCtx();
  if (!c) return;
  const preset = resolvePreset(id);
  const t0 = c.currentTime + 0.02;
  for (const t of preset.tones) tone(c, t0 + t.offset, t, preset.type, preset.peakGain);
}

/**
 * Plays the current game's chosen sound; urgent alerts repeat the whole
 * sequence once more so even a discreet sound stays a notch more insistent.
 */
function playAlarm(soundId: NotificationSoundId | null | undefined, urgent: boolean) {
  const c = audioCtx();
  if (!c) return;
  const preset = resolvePreset(soundId);
  const t0 = c.currentTime + 0.02;
  const playOnce = (base: number) => {
    for (const t of preset.tones) tone(c, base + t.offset, t, preset.type, preset.peakGain);
  };
  playOnce(t0);
  if (urgent) {
    const last = preset.tones[preset.tones.length - 1]!;
    playOnce(t0 + last.offset + last.dur + 0.3);
  }
}

function vibrate(urgent: boolean) {
  try {
    navigator.vibrate?.(urgent ? [300, 120, 300, 120, 600] : [200, 100, 200]);
  } catch {
    /* vibration unsupported — sound and toast still carry the message */
  }
}

// Which sound the current screen's game is configured to use — set once via
// setNotificationSound() when the game loads, so every notifyMessage/
// notifyUrgent call site doesn't need to thread the game's setting through.
let currentSound: NotificationSoundId = DEFAULT_NOTIFICATION_SOUND;

export function setNotificationSound(id: NotificationSoundId | null | undefined) {
  currentSound = id && SOUND_PRESETS[id] ? id : DEFAULT_NOTIFICATION_SOUND;
}

/**
 * Alerts the user something happened: the game's chosen sound plus
 * vibration every time, and an OS notification whenever permission was
 * granted (kept on screen for urgent alerts so it isn't missed while the
 * phone is in a pocket).
 */
export function notifyMessage(title: string, body: string, urgent = false) {
  playAlarm(currentSound, urgent);
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
