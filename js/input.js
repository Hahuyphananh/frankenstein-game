/**
 * Keyboard state, subscriptions and movement key mapping.
 */

const WASD_DIRECTIONS = Object.freeze({
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
});

const ARROW_DIRECTIONS = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
});

const KEY_DIRECTIONS = Object.freeze({
  ...ARROW_DIRECTIONS,
  ...WASD_DIRECTIONS,
});

export function directionForKey(code) {
  return KEY_DIRECTIONS[code] ?? null;
}

export function wasdDirectionForKey(code) {
  return WASD_DIRECTIONS[code] ?? null;
}

export function arrowDirectionForKey(code) {
  return ARROW_DIRECTIONS[code] ?? null;
}

export class Keyboard {
  constructor(target = window) {
    this.target = target;
    this.pressed = new Set();
    this.listeners = new Set();

    this.handleKeyDown = (event) => {
      if (event.repeat) return;

      this.pressed.add(event.code);
      for (const listener of this.listeners) listener(event);
    };

    this.handleKeyUp = (event) => {
      this.pressed.delete(event.code);
    };

    this.handleBlur = () => {
      this.pressed.clear();
    };

    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  /** Returns an unsubscribe function. */
  onKeyDown(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isDown(code) {
    return this.pressed.has(code);
  }

  destroy() {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.listeners.clear();
    this.pressed.clear();
  }
}
