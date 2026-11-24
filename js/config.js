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

/** The player-controlled Creature: manual dash, no wall breaking. */
export const PLAYER_CREATURE_PROFILE = Object.freeze({
  strategy: 'evade',
  dashCooldown: 2,
  dashDuration: 1.2,
  dashMultiplier: 3,
  destroyWalls: false,
});

/** Victor surges for five seconds every ten seconds. */
export const VICTOR_POWER = Object.freeze({
  interval: 10,
  duration: 5,
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
    note: 'sa rage vengeresse le lance à pleine vitesse sur vos traces',
  }),
  eclair: Object.freeze({
    id: 'eclair',
    label: 'Éclair',
    note: 'l’étincelle de vie le téléporte de quelques cases vers vous',
  }),
  brume: Object.freeze({
    id: 'brume',
    label: 'Brume',
    note: 'la brume le rend spectral et difficile à suivre',
  }),
  pacte: Object.freeze({
    id: 'pacte',
    label: 'Serment',
    note: 'son serment le pousse à monter la garde près de la personne protégée',
  }),
});

export const VICTOR_POWER_CYCLE = Object.freeze(['rage', 'eclair', 'brume', 'pacte']);

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    label: 'Facile',
    creatureSpeed: 5.2,
    elizabethSpeed: 3,
    victorSpeed: 3.8,
    victorSurgeSpeed: 5.7,
    hint: 'La chasse est courte et Victor traque lentement. Il libère un pouvoir 5 secondes toutes les 10 secondes ; la ruée de la Créature revient toutes les 2 secondes.',
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'Normal',
    creatureSpeed: 5.2,
    elizabethSpeed: 3.5,
    victorSpeed: 4.6,
    victorSurgeSpeed: 7,
    hint: 'La personne protégée fuit plus longtemps et Victor se rapproche de votre vitesse. Il libère un pouvoir 5 secondes toutes les 10 secondes ; la ruée revient toutes les 2 secondes.',
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'Difficile',
    creatureSpeed: 5.2,
    elizabethSpeed: 3.9,
    victorSpeed: 5.2,
    victorSurgeSpeed: 8.6,
    hint: 'La poursuite dure, Victor colle à votre vitesse et ses pouvoirs atteignent leur sommet. Il libère un pouvoir 5 secondes toutes les 10 secondes ; la ruée revient toutes les 2 secondes.',
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
