/**
 * Shared game constants and all difficulty tuning.
 * Speeds are in maze tiles per second, time limits in seconds. Creature
 * behaviour and scoring are profile-driven so strategy code stays free of
 * hardcoded tuning values.
 */

export const STORAGE_KEY = 'frankenstein:settings:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'guardian',
  difficulty: 'normal',
  sound: true,
});

export const MODE_ORDER = Object.freeze(['guardian', 'creature']);

export function isMode(value) {
  return value === 'guardian' || value === 'creature';
}

/** Capture-loop rules shared by every difficulty. */
export const CREATURE_RULES = Object.freeze({
  lives: 3,
  respawnInvulnerability: 4,
  hitDistance: 0.7,
});

/** Behaviour shared by every difficulty; only speed and path recognition vary. */
const CREATURE_BASE = Object.freeze({
  strategy: 'evade',
  continueChance: 0.5,
  victorAwareness: 4,
  victorAvoidWeight: 4,
  victorMinDistance: 1,
  dashCooldown: 2,
  dashDuration: 1.2,
  dashMultiplier: 3,
  destroyWalls: true,
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    label: 'Facile',
    playerSpeed: 4.6,
    timeLimit: 120,
    starThresholds: Object.freeze({ three: 60, two: 95 }),
    hint: 'Une Créature lente et directe. La ruée revient toutes les 2 s et brise les murs sur son passage. 120 secondes et trois vies.',
    creature: Object.freeze({
      ...CREATURE_BASE,
      speed: 1.4,
      pathRecognition: 0,
    }),
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'Normal',
    playerSpeed: 5,
    timeLimit: 90,
    starThresholds: Object.freeze({ three: 40, two: 70 }),
    hint: 'Une Créature qui suit le chemin le plus court sans anticiper Victor. La ruée revient toutes les 2 s et brise les murs sur son passage. 90 secondes et trois vies.',
    creature: Object.freeze({
      ...CREATURE_BASE,
      speed: 1.7,
      pathRecognition: 1,
    }),
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'Difficile',
    playerSpeed: 5.6,
    timeLimit: 60,
    starThresholds: Object.freeze({ three: 25, two: 45 }),
    hint: 'La Créature la plus rapide, avec le chemin le plus court et l’évitement de Victor. La ruée revient toutes les 2 s et brise les murs sur son passage. 60 secondes et trois vies.',
    creature: Object.freeze({
      ...CREATURE_BASE,
      speed: 1.8,
      pathRecognition: 2,
    }),
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
