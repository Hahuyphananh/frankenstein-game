/**
 * Shared game constants and all difficulty tuning.
 * Speeds are in maze tiles per second. The player controls the Creature;
 * Victor is an AI hunter whose speed and periodic surge are profile-driven.
 */

export const STORAGE_KEY = 'frankenstein:settings:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 'normal',
  sound: true,
});

/** A single touch from Victor ends the run. */
export const CREATURE_RULES = Object.freeze({
  lives: 1,
  respawnInvulnerability: 0,
  hitDistance: 0.7,
});

/** The player-controlled Creature: a short dash that shatters one wall. */
export const PLAYER_CREATURE_PROFILE = Object.freeze({
  strategy: 'evade',
  dashCooldown: 5,
  dashDuration: 0.65,
  dashMultiplier: 2.2,
  destroyWalls: true,
});

/** Victor recharges for six seconds, then surges for three. */
export const VICTOR_POWER = Object.freeze({
  interval: 6,
  duration: 3,
  /** Seconds of HUD pulse and audible cue before the surge lands. */
  windup: 1.5,
});

/**
 * Each surge reaches top speed and manifests one of Victor's powers, each
 * drawn from the novel. The plain Rage surge comes first so the chase is
 * learned before the tricks arrive.
 */
export const VICTOR_POWERS = Object.freeze({
  rage: Object.freeze({
    id: 'rage',
    label: 'Rage',
    warning: 'Rage imminente',
    note: 'sa rage vengeresse le lance à pleine vitesse sur vos traces',
  }),
  eclair: Object.freeze({
    id: 'eclair',
    label: 'Éclair',
    warning: 'Éclair imminent',
    note: 'l’étincelle de vie le téléporte de quelques cases vers vous',
  }),
  brume: Object.freeze({
    id: 'brume',
    label: 'Brume',
    warning: 'Brume imminente',
    note: 'la brume le rend spectral et difficile à suivre',
  }),
  pacte: Object.freeze({
    id: 'pacte',
    label: 'Serment',
    warning: 'Serment imminent',
    note: 'son serment le pousse à monter la garde près de la personne protégée',
  }),
});

export const VICTOR_POWER_CYCLE = Object.freeze(['rage', 'eclair', 'brume', 'pacte']);

/**
 * Per-power adjustments. The faster recharge keeps Victor busy, but each
 * manifestation is milder: Éclair lands farther away and the Brume/Serment
 * surges move below a full rage.
 */
export const VICTOR_POWER_EFFECTS = Object.freeze({
  eclair: Object.freeze({ blinkSteps: 3, blinkStop: 3 }),
  brume: Object.freeze({ speedScale: 0.85 }),
  pacte: Object.freeze({ speedScale: 0.9 }),
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    label: 'ez',
    creatureSpeed: 5.2,
    elizabethSpeed: 2.8,
    victorSpeed: 3.4,
    victorSurgeSpeed: 4.6,
    victorPowerInterval: 8,
    victorPowerDuration: 2,
    victorPowerWindup: 2.2,
    hint: 'ez : Victor traque lentement, recharge 8 secondes, prévient 2,2 secondes à l’avance et bondit 2 secondes. La ruée de la Créature revient toutes les 5 secondes.',
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'npc',
    creatureSpeed: 5.2,
    elizabethSpeed: 3.5,
    victorSpeed: 4.6,
    victorSurgeSpeed: 6,
    victorPowerInterval: 6,
    victorPowerDuration: 3,
    victorPowerWindup: 1.5,
    hint: 'npc : Victor recharge 6 secondes, prévient 1,5 seconde à l’avance et bondit 3 secondes. La ruée de la Créature revient toutes les 5 secondes.',
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'harr',
    creatureSpeed: 5.2,
    elizabethSpeed: 4,
    victorSpeed: 5.2,
    victorSurgeSpeed: 7.4,
    victorPowerInterval: 4.5,
    victorPowerDuration: 3.5,
    victorPowerWindup: 0.9,
    hint: 'harr : Victor recharge 4,5 secondes, prévient seulement 0,9 seconde et bondit 3,5 secondes. La ruée de la Créature revient toutes les 5 secondes.',
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
