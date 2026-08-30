/**
 * Minimal 2D random-walk position Kalman filter, the same well-established
 * technique behind most mobile "smoothed location" implementations. Not
 * full inertial dead-reckoning (no directional integration of
 * acceleration), so there's no drift risk if a device-motion hint is noisy
 * or unavailable — worst case it just falls back to smoothing GPS fixes
 * against their own reported accuracy.
 */
export class GeoKalmanFilter {
  private lat = 0;
  private lng = 0;
  private variance = -1;
  private lastMs = 0;

  /**
   * Feeds one raw GPS fix through the filter and returns the smoothed
   * position. `movingFast` (from a device-motion hint, when available)
   * widens how much the filter trusts the new fix while the player is
   * actually moving, so smoothing settles jitter at a standstill without
   * lagging behind someone who's actually running.
   */
  update(
    lat: number,
    lng: number,
    accuracyM: number,
    nowMs: number,
    movingFast: boolean,
  ): [number, number] {
    const accuracy = Math.max(accuracyM, 1);
    if (this.variance < 0) {
      this.lat = lat;
      this.lng = lng;
      this.variance = accuracy * accuracy;
      this.lastMs = nowMs;
      return [lat, lng];
    }

    const dtS = Math.max(0, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    // Assumed max plausible speed (m/s) used to grow position uncertainty
    // between fixes: a jog if the accelerometer says we're moving, an
    // amble otherwise. This is what lets standing-still jitter settle
    // while still catching up quickly once someone actually runs.
    const assumedSpeedMs = movingFast ? 3 : 0.6;
    this.variance += dtS * assumedSpeedMs * assumedSpeedMs;

    const gain = this.variance / (this.variance + accuracy * accuracy);
    this.lat += gain * (lat - this.lat);
    this.lng += gain * (lng - this.lng);
    this.variance = (1 - gain) * this.variance;
    return [this.lat, this.lng];
  }
}
