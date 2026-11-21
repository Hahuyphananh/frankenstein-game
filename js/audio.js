/**
 * Tiny synthesized UI sound layer built on the Web Audio API.
 * No audio files, no network requests — everything is generated on demand.
 */

const VOICES = {
  move: [{ f: 440, d: 0.07, type: 'square', gain: 0.05 }],
  confirm: [
    { f: 523.25, d: 0.1, type: 'triangle', gain: 0.09 },
    { f: 783.99, d: 0.18, type: 'triangle', gain: 0.08, at: 0.08 },
  ],
  back: [
    { f: 392, d: 0.1, type: 'triangle', gain: 0.07 },
    { f: 261.63, d: 0.16, type: 'triangle', gain: 0.07, at: 0.08 },
  ],
  toggle: [
    { f: 660, d: 0.08, type: 'triangle', gain: 0.07 },
    { f: 990, d: 0.12, type: 'triangle', gain: 0.06, at: 0.06 },
  ],
  open: [
    { f: 329.63, d: 0.14, type: 'triangle', gain: 0.07 },
    { f: 493.88, d: 0.2, type: 'triangle', gain: 0.06, at: 0.1 },
  ],
  close: [
    { f: 493.88, d: 0.1, type: 'triangle', gain: 0.06 },
    { f: 329.63, d: 0.16, type: 'triangle', gain: 0.06, at: 0.07 },
  ],
  hit: [
    { f: 196, d: 0.12, type: 'square', gain: 0.07 },
    { f: 130.81, d: 0.2, type: 'sawtooth', gain: 0.06, at: 0.03 },
  ],
  win: [
    { f: 392, d: 0.12, type: 'triangle', gain: 0.08 },
    { f: 523.25, d: 0.12, type: 'triangle', gain: 0.08, at: 0.12 },
    { f: 659.25, d: 0.14, type: 'triangle', gain: 0.08, at: 0.24 },
    { f: 783.99, d: 0.3, type: 'triangle', gain: 0.08, at: 0.36 },
  ],
  lose: [
    { f: 261.63, d: 0.18, type: 'sawtooth', gain: 0.06 },
    { f: 196, d: 0.22, type: 'triangle', gain: 0.07, at: 0.16 },
    { f: 130.81, d: 0.4, type: 'triangle', gain: 0.08, at: 0.34 },
  ],
};

export class AudioBus {
  constructor({ enabled = true } = {}) {
    this.enabled = Boolean(enabled);
    this.context = null;
    this.master = null;
    this.supported =
      typeof window !== 'undefined' &&
      Boolean(window.AudioContext || window.webkitAudioContext);
  }

  /** Must be called from a user gesture before the first sound plays. */
  unlock() {
    if (!this.supported) return null;

    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }

    return this.context;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  play(name) {
    if (!this.enabled) return;

    const context = this.unlock();
    if (!context) return;

    const notes = VOICES[name];
    if (!notes) return;

    const startAt = context.currentTime;
    for (const note of notes) {
      const begin = startAt + (note.at ?? 0);
      const end = begin + note.d;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = note.type ?? 'triangle';
      oscillator.frequency.setValueAtTime(note.f, begin);

      gain.gain.setValueAtTime(0.0001, begin);
      gain.gain.exponentialRampToValueAtTime(note.gain ?? 0.2, begin + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(begin);
      oscillator.stop(end + 0.05);
    }
  }

  destroy() {
    this.context?.close().catch(() => {});
    this.context = null;
    this.master = null;
  }
}
