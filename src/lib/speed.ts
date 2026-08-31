/**
 * Speed estimation that refuses to guess.
 *
 * Raw `distance / time` between two GPS fixes is wildly unreliable in town:
 * a single bad fix (tall buildings, tunnel exit, phone in a pocket) can jump
 * 60 m in one second and look like a car. That produced bogus "vehicle"
 * penalties, so every sample here has to earn its place:
 *  - fixes with poor accuracy are dropped entirely;
 *  - the travelled distance must clearly exceed the position uncertainty;
 *  - the result is smoothed, so one outlier can never trip a penalty alone.
 */

/** Fixes less precise than this (in meters) are ignored for speed. */
export const SPEED_MAX_ACCURACY_M = 25;

const SMOOTHING = 0.4;

export class SpeedTracker {
  private last: { point: [number, number]; t: number } | null = null;
  private smoothed = 0;

  /** Returns the smoothed speed in m/s, or 0 while the signal can't be trusted. */
  update(
    point: [number, number],
    accuracyM: number | null,
    gpsSpeed: number | null,
    tMs: number,
    haversine: (a: [number, number], b: [number, number]) => number,
  ): number {
    const acc = accuracyM ?? 999;
    if (acc > SPEED_MAX_ACCURACY_M) {
      // Bad fix: forget history so the next good fix doesn't produce a huge jump.
      this.last = null;
      this.smoothed = 0;
      return 0;
    }

    // The device's own Doppler speed is far more reliable than differencing
    // positions — use it whenever the platform provides one.
    if (gpsSpeed != null && Number.isFinite(gpsSpeed) && gpsSpeed >= 0) {
      this.last = { point, t: tMs };
      this.smoothed = this.smoothed * (1 - SMOOTHING) + gpsSpeed * SMOOTHING;
      return this.smoothed;
    }

    const prev = this.last;
    this.last = { point, t: tMs };
    if (!prev) return this.smoothed;

    const dt = (tMs - prev.t) / 1000;
    if (dt < 1) {
      this.last = prev;
      return this.smoothed;
    }
    const dist = haversine(prev.point, point);
    // Movement has to be bigger than the uncertainty of the two fixes combined.
    if (dist < Math.max(5, acc)) {
      this.smoothed = this.smoothed * (1 - SMOOTHING);
      return this.smoothed;
    }
    const inst = dist / dt;
    // 30 m/s (108 km/h) on foot-scale GPS is a glitch, not a reading.
    if (inst > 30) return this.smoothed;
    this.smoothed = this.smoothed * (1 - SMOOTHING) + inst * SMOOTHING;
    return this.smoothed;
  }

  reset() {
    this.last = null;
    this.smoothed = 0;
  }
}
