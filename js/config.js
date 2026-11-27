/**
 * Shared game constants and all difficulty tuning.
 * Speeds are in maze tiles per second. The player controls the Creature;
 * Victor is an AI hunter whose speed and periodic surge are profile-driven.
 */

export const SETTINGS_COOKIE = 'frankenstein_settings_v1';
export const PLAYER_NAME_COOKIE = 'frankenstein_player_name_v1';
export const LEADERBOARD_COOKIE_PREFIX = 'frankenstein_leaderboard_v1_';

// Read once to migrate records saved by the previous localStorage version.
export const LEGACY_SETTINGS_KEY = 'frankenstein:settings:v1';
export const LEGACY_LEADERBOARD_KEY = 'frankenstein:leaderboard:v1';

export const LEADERBOARD_LIMIT = 5;
export const DEFAULT_PLAYER_NAME = 'Anonyme';
export const PLAYER_NAME_MAX_LENGTH = 20;

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 'normal',
  sound: true,
});

/** Keep a submitted player name short and non-empty. */
export function sanitizePlayerName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.slice(0, PLAYER_NAME_MAX_LENGTH) || DEFAULT_PLAYER_NAME;
}

/** A single touch from Victor ends the run. */
export const CREATURE_RULES = Object.freeze({
  lives: 1,
  respawnInvulnerability: 0,
  hitDistance: 0.7,
});

/** The player-controlled Creature: a short straight dash through up to four walls. */
export const PLAYER_CREATURE_PROFILE = Object.freeze({
  strategy: 'evade',
  dashCooldown: 5,
  dashDuration: 0.65,
  dashMultiplier: 2.2,
  destroyWalls: true,
  dashMaxWalls: 4,
});

/** Victor always has a power active; duration is the default phase length. */
export const VICTOR_POWER = Object.freeze({
  duration: 3.5,
});

/**
 * Victor is permanently under one of these powers and switches to the next
 * when its phase ends. Each power has its own HUD and board colour.
 */
export const VICTOR_POWERS = Object.freeze({
  rage: Object.freeze({
    id: 'rage',
    label: 'Rage',
    color: '#ff5c7a',
    soft: 'rgba(255, 92, 122, 0.1)',
    rgb: '255, 92, 122',
    note: 'sa rage vengeresse accélère encore sa course sur vos traces',
  }),
  eclair: Object.freeze({
    id: 'eclair',
    label: 'Éclair',
    color: '#7fd7ff',
    soft: 'rgba(127, 215, 255, 0.1)',
    rgb: '127, 215, 255',
    note: 'l’étincelle de vie le téléporte de sept cases vers vous',
  }),
  brume: Object.freeze({
    id: 'brume',
    label: 'Brume',
    color: '#b8d8c8',
    soft: 'rgba(184, 216, 200, 0.1)',
    rgb: '184, 216, 200',
    note: 'la brume l’efface complètement et il se rapproche sans qu’on le voie',
  }),
  pacte: Object.freeze({
    id: 'pacte',
    label: 'Serment',
    color: '#ffd166',
    soft: 'rgba(255, 209, 102, 0.12)',
    rgb: '255, 209, 102',
    note: 'son serment le pousse à garder la personne protégée et à charger ce qui l’approche',
  }),
});

export const VICTOR_POWER_CYCLE = Object.freeze(['rage', 'eclair', 'brume', 'pacte']);

/**
 * Per-power movement adjustments.
 *
 *   rage    a small edge over his hunt speed (the "maddening rage"), no longer
 *           the big surge it used to be
 *   eclair  a long blink: seven tiles toward the Creature, stopping two short
 *   brume   complete invisibility, but its phase is shorter than the others
 *   pacte   guards at full hunt speed and charges anything that comes within
 *           guardRadius tiles of the protected person
 */
export const VICTOR_POWER_EFFECTS = Object.freeze({
  rage: Object.freeze({ speedScale: 1.05 }),
  eclair: Object.freeze({ blinkSteps: 7, blinkStop: 2 }),
  brume: Object.freeze({ speedScale: 0.9, durationScale: 0.55 }),
  pacte: Object.freeze({ speedScale: 1, guardRadius: 6 }),
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    label: 'ez',
    creatureSpeed: 5.2,
    elizabethSpeed: 2.8,
    victorSpeed: 3.2,
    victorSurgeSpeed: 4.6,
    victorPowerDuration: 4.5,
    hint: 'ez : Victor traque lentement et garde chaque pouvoir 4,5 secondes ; sa Rage le rend plus rapide. La ruée de la Créature revient toutes les 5 secondes.',
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'npc',
    creatureSpeed: 5.2,
    elizabethSpeed: 3.5,
    victorSpeed: 4.6,
    victorSurgeSpeed: 6,
    victorPowerDuration: 3.5,
    hint: 'npc : Victor garde chaque pouvoir 3,5 secondes ; sa Rage le rend plus rapide. La ruée de la Créature revient toutes les 5 secondes.',
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'harr',
    creatureSpeed: 5.2,
    elizabethSpeed: 4,
    victorSpeed: 4.6,
    victorSurgeSpeed: 6.2,
    victorPowerDuration: 2.5,
    hint: 'harr : Victor change de pouvoir toutes les 2,5 secondes ; sa Rage le rend plus rapide. La ruée de la Créature revient toutes les 5 secondes.',
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
