/**
 * Wall-clock countdown timer. Elapsed time is derived from timestamps rather
 * than accumulated frame deltas, so rendering hitches or frame-rate changes
 * cannot drift the clock. Pausing banks the elapsed time; resuming restarts
 * the wall-clock span from that banked value.
 */
export class CountdownTimer {
  constructor({ limitSeconds }) {
    if (!Number.isFinite(limitSeconds) || limitSeconds <= 0) {
      throw new Error('CountdownTimer: limitSeconds must be a positive number.');
    }

    this.limitSeconds = limitSeconds;
    this.limitMs = limitSeconds * 1000;
    this.elapsedMs = 0;
    this.startedAt = 0;
    this.running = false;
    this.finished = false;
  }

  start(now = performance.now()) {
    this.elapsedMs = 0;
    this.startedAt = now;
    this.running = true;
    this.finished = false;
  }

  elapsed(now = performance.now()) {
    const live = this.running ? Math.max(0, now - this.startedAt) : 0;
    return this.elapsedMs + live;
  }

  remaining(now = performance.now()) {
    return Math.max(0, this.limitMs - this.elapsed(now));
  }

  remainingSeconds(now = performance.now()) {
    return Math.ceil(this.remaining(now) / 1000);
  }

  isExpired(now = performance.now()) {
    return this.remaining(now) <= 0;
  }

  pause(now = performance.now()) {
    if (!this.running) return;
    this.elapsedMs += Math.max(0, now - this.startedAt);
    this.running = false;
  }

  resume(now = performance.now()) {
    if (this.running || this.finished) return;
    this.startedAt = now;
    this.running = true;
  }

  /** Stops the clock and returns the final elapsed milliseconds. */
  stop(now = performance.now()) {
    if (this.running) {
      this.elapsedMs += Math.max(0, now - this.startedAt);
      this.running = false;
    }
    this.finished = true;
    return this.elapsedMs;
  }
}

/**
 * 3 stars inside the "three" threshold, 2 inside "two", otherwise 1 for any
 * completed run. A loss is scored separately as zero stars.
 */
export function starsForTime(elapsedMs, thresholds) {
  if (!thresholds) return 0;
  if (elapsedMs <= thresholds.three * 1000) return 3;
  if (elapsedMs <= thresholds.two * 1000) return 2;
  return 1;
}

/** Whole-second clock display: 90 -> "1:30", 0 -> "0:00". */
export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0),
  );
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
