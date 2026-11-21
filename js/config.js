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

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    label: 'Facile',
    playerSpeed: 5,
    timeLimit: 120,
    starThresholds: Object.freeze({ three: 60, two: 95 }),
    hint: 'Une Créature lente et simple. La première ruée attend 10 s, puis revient toutes les 10 s ; elle brise les murs sur son passage. 120 secondes et trois vies.',
    creature: Object.freeze({
      strategy: 'wander',
      speed: 1.4,
      continueChance: 0.55,
      pathRecognition: false,
      victorAwareness: 0,
      victorAvoidWeight: 0,
      dashCooldown: 10,
      dashDuration: 1.2,
      dashMultiplier: 3,
      destroyWalls: true,
    }),
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'Normal',
    playerSpeed: 5,
    timeLimit: 90,
    starThresholds: Object.freeze({ three: 40, two: 70 }),
    hint: 'Une Créature qui reconnaît les chemins et évite un peu Victor. La première ruée attend 5 s, puis revient toutes les 5 s ; elle brise les murs sur son passage. 90 secondes et trois vies.',
    creature: Object.freeze({
      strategy: 'evade',
      speed: 1.7,
      continueChance: 0.5,
      pathRecognition: true,
      victorAwareness: 4,
      victorAvoidWeight: 4,
      victorMinDistance: 1,
      dashCooldown: 5,
      dashDuration: 1.2,
      dashMultiplier: 3,
      destroyWalls: true,
    }),
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'Difficile',
    playerSpeed: 5.6,
    timeLimit: 60,
    starThresholds: Object.freeze({ three: 25, two: 45 }),
    hint: 'La Créature la plus rapide et la plus évasive. La première ruée attend 2 s, puis revient toutes les 2 s ; elle brise les murs sur son passage. 60 secondes et trois vies.',
    creature: Object.freeze({
      strategy: 'outwit',
      speed: 1.8,
      continueChance: 0.35,
      pathRecognition: true,
      victorAwareness: 7,
      victorAvoidWeight: 10,
      victorMinDistance: 2,
      dashCooldown: 2,
      dashDuration: 1.2,
      dashMultiplier: 3,
      destroyWalls: true,
    }),
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
