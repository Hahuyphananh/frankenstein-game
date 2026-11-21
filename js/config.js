/**
 * Shared game constants and all difficulty tuning.
 * Speeds are in maze tiles per second, time limits in seconds. Creature
 * behaviour and scoring are profile-driven so strategy code stays free of
 * hardcoded tuning values.
 */

export const STORAGE_KEY = 'frankenstein:settings:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 'normal',
  sound: true,
  mapLayout: 'full',
});

/** Capture-loop rules shared by every difficulty. */
export const CREATURE_RULES = Object.freeze({
  lives: 3,
  respawnInvulnerability: 2,
  hitDistance: 0.7,
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    label: 'Facile',
    playerSpeed: 5,
    timeLimit: 120,
    starThresholds: Object.freeze({ three: 60, two: 95 }),
    hint: 'Une Créature lente et simple. Ruée toutes les 16 s. 120 secondes et trois vies.',
    creature: Object.freeze({
      strategy: 'wander',
      speed: 1.5,
      continueChance: 0.55,
      pathRecognition: false,
      victorAwareness: 0,
      victorAvoidWeight: 0,
      dashCooldown: 16,
      dashDuration: 0.8,
      dashMultiplier: 2.1,
      dashRange: 6,
      destroyWalls: false,
    }),
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'Normal',
    playerSpeed: 5,
    timeLimit: 90,
    starThresholds: Object.freeze({ three: 40, two: 70 }),
    hint: 'Une Créature qui reconnaît les chemins et évite un peu Victor. Ruée toutes les 10 s. 90 secondes et trois vies.',
    creature: Object.freeze({
      strategy: 'evade',
      speed: 1.8,
      continueChance: 0.5,
      pathRecognition: true,
      victorAwareness: 4,
      victorAvoidWeight: 4,
      victorMinDistance: 1,
      dashCooldown: 10,
      dashDuration: 0.8,
      dashMultiplier: 2.2,
      dashRange: 6,
      destroyWalls: false,
    }),
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'Difficile',
    playerSpeed: 5.6,
    timeLimit: 60,
    starThresholds: Object.freeze({ three: 25, two: 45 }),
    hint: 'La Créature la plus rapide et la plus évasive. Ruée toutes les 8 s, un mur brisé par vie. 60 secondes et trois vies.',
    creature: Object.freeze({
      strategy: 'outwit',
      speed: 1.9,
      continueChance: 0.35,
      pathRecognition: true,
      victorAwareness: 7,
      victorAvoidWeight: 10,
      victorMinDistance: 2,
      dashCooldown: 8,
      dashDuration: 0.9,
      dashMultiplier: 2.3,
      dashRange: 7,
      destroyWalls: true,
      wallBreakPerLife: true,
    }),
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
