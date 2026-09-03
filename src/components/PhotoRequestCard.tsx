import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { formatClock } from "@/lib/conquete";
import { uploadTeamPhoto } from "@/lib/photoCheck";
import { notifyUrgent } from "@/lib/notify";
import { getTerminology, type Terminology } from "@/lib/terminology";

type Props = {
  gameId: string;
  teamId: string;
  /** `games.photo_requested_at` — a new value means a brand-new request. */
  requestedAt: string | null | undefined;
  photoDeadline: string | null | undefined;
  /** Ticking clock from the parent view, so the countdown stays in sync. */
  nowMs: number;
  terminology: Terminology | null | undefined;
};

/**
 * The teacher's photo check-in, shown identically in every game mode.
 * Lives in one component so a new mode can never silently lose the feature.
 */
export function PhotoRequestCard({
  gameId,
  teamId,
  requestedAt,
  photoDeadline,
  nowMs,
  terminology,
}: Props) {
  const t = getTerminology(terminology);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const alertedRef = useRef<string | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const storageKey = requestedAt ? `conquete:photo:${teamId}:${requestedAt}` : null;

  useEffect(() => {
    setFailed(false);
    lastFileRef.current = null;
    if (!storageKey) {
      setSentAt(null);
      return;
    }
    setSentAt(localStorage.getItem(storageKey));
  }, [storageKey]);

  // Loud alert the moment a request arrives (once per request).
  useEffect(() => {
    if (!requestedAt || alertedRef.current === requestedAt) return;
    const first = alertedRef.current === null;
    alertedRef.current = requestedAt;
    if (first && localStorage.getItem(`conquete:photo:${teamId}:${requestedAt}`)) return;
    toast(t.photoRequestedToast, { duration: 10000 });
    notifyUrgent("📸 Photo demandée !", "Prenez une photo de votre groupe maintenant.", "photo");
  }, [requestedAt, teamId, t]);

  async function sendPhoto(file: File) {
    if (!storageKey) return;
    lastFileRef.current = file;
    setFailed(false);
    setSending(true);
    try {
      await uploadTeamPhoto(gameId, teamId, file);
      const at = new Date().toISOString();
      localStorage.setItem(storageKey, at);
      setSentAt(at);
      toast.success(t.photoSentToast);
    } catch (e) {
      setFailed(true);
      toast.error(`Échec de l'envoi : ${e instanceof Error ? e.message : "réessayez"}`);
    } finally {
      setSending(false);
    }
  }

  if (!requestedAt) return null;

  const remaining = photoDeadline ? (new Date(photoDeadline).getTime() - nowMs) / 1000 : null;

  if (sentAt) {
    return (
      <div className="panel flex items-center gap-2 px-4 py-3">
        <Camera className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-sm font-semibold">{t.photoSentLabel}</span>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-3 px-4 py-3 ring-2 ring-accent">
      <div className="section-title">
        <Camera className="h-4 w-4" /> Photo demandée
      </div>
      <div className="text-sm font-semibold">
        {t.photoRequestedCardText}
        {remaining !== null && remaining > 0
          ? ` — il reste ${formatClock(remaining)}`
          : " — délai dépassé, envoyez-la quand même"}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void sendPhoto(file);
          e.target.value = "";
        }}
      />
      <button
        className="btn-huge btn-huge-accent"
        disabled={sending}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-6 w-6" /> {sending ? "Envoi..." : "Prendre la photo"}
      </button>
      {failed && !sending && (
        <button
          className="btn-huge btn-huge-dark"
          onClick={() => lastFileRef.current && void sendPhoto(lastFileRef.current)}
        >
          Réessayer l'envoi (sans reprendre la photo)
        </button>
      )}
    </div>
  );
}
