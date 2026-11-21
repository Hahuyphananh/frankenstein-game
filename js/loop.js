/**
 * Shared game loop. One requestAnimationFrame cycle drives both simulation
 * and rendering, with a clamped delta so tab switches cannot teleport actors.
 */
export class GameLoop {
  constructor({ update, render, maxDelta = 0.05 }) {
    if (typeof update !== 'function' || typeof render !== 'function') {
      throw new Error('GameLoop: update and render callbacks are required.');
    }

    this.update = update;
    this.render = render;
    this.maxDelta = maxDelta;
    this.frame = null;
    this.last = 0;

    this.tick = this.tick.bind(this);
    this.onVisibility = () => {
      if (document.hidden) this.stop();
      else this.start();
    };

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start() {
    if (this.frame !== null) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  tick(now) {
    this.frame = null;
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), this.maxDelta);
    this.last = now;

    this.update(dt);
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
