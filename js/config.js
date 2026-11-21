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
    label: 'Easy',
    playerSpeed: 4.2,
    timeLimit: 120,
    starThresholds: Object.freeze({ three: 60, two: 95 }),
    hint: 'Slow Creature, dashes every 14s. 120 seconds and three lives.',
    creature: Object.freeze({
      strategy: 'wander',
      speed: 3.1,
      continueChance: 0.55,
      dashCooldown: 14,
      dashDuration: 0.45,
      dashMultiplier: 2,
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
    hint: 'Dashing Creature, 10s dash cooldown. 90 seconds and three lives.',
    creature: Object.freeze({
      strategy: 'evade',
      speed: 3.9,
      continueChance: 0.5,
      fleeRadius: 7,
      dashCooldown: 10,
      dashDuration: 0.5,
      dashMultiplier: 2.15,
      dashRange: 7,
      destroyWalls: false,
    }),
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'Hard',
    playerSpeed: 5.6,
    timeLimit: 60,
    starThresholds: Object.freeze({ three: 25, two: 45 }),
    hint: 'Fastest Creature. Dashes every 8s and shatters walls. 60 seconds and three lives.',
    creature: Object.freeze({
      strategy: 'outwit',
      speed: 4.7,
      continueChance: 0.35,
      lookahead: 7,
      avoidDeadEnds: true,
      distanceWeight: 1,
      escapeWeight: 1.6,
      opennessWeight: 3,
      deadEndPenalty: 400,
      jitter: 1.5,
      dashCooldown: 8,
      dashDuration: 0.55,
      dashMultiplier: 2.3,
      dashRange: 8,
      destroyWalls: true,
    }),
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
