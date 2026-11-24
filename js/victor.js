import { GridActor } from './actor.js';
import { VICTOR_POWER, VICTOR_POWER_CYCLE } from './config.js';
import { DIRECTIONS, walkableNeighbors } from './maze.js';
import { buildDistanceField, fieldDistance } from './pathing.js';

const OPPOSITE = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
});

/**
 * Victor Frankenstein, now entirely AI-controlled.
 *
 * He follows the shortest route to the Creature's current tile at a slightly
 * lower speed than the player. Every 10 seconds he surges for 5 seconds at
 * top speed, and each surge also manifests one of his four powers:
 *
 *   rage    pure pursuit ("maddening rage")
 *   eclair  blinks several tiles toward the Creature (the spark of life)
 *   brume   turns spectral while hunting (the mists where the Creature appears)
 *   pacte   runs to guard the protected person (his vow to Elizabeth)
 *
 * The surge is telegraphed by the HUD, so the player can dash or break line of
 * sight before it lands.
 */
export class VictorHunter extends GridActor {
  constructor({
    maze,
    spawn,
    speed,
    surgeSpeed,
    power = VICTOR_POWER,
    powerCycle = VICTOR_POWER_CYCLE,
    onBlink = null,
    rng = Math.random,
  }) {
    super({ maze, spawn, speed });
    this.huntSpeed = speed;
    this.surgeSpeed = surgeSpeed;
    this.powerInterval = power.interval;
    this.powerDuration = power.duration;
    this.windupFor = power.windup ?? 1.5;
    this.powerCycle = powerCycle.length ? powerCycle : ['rage'];
    this.onBlink = onBlink;
    this.rng = rng;
    this.goalKey = null;
    this.goalField = null;
    this.reset();
  }

  reset() {
    super.reset();
    this.goalKey = null;
    this.goalField = null;
    this.surgeFor = 0;
    this.powerCooldownFor = this.powerInterval;
    this.powerIndex = 0;
    this.activePower = 'rage';
    this.guarding = false;
    this.blinks = 0;
    this.speed = this.huntSpeed;
  }

  get surging() {
    return this.surgeFor > 0;
  }

  get surgeRemaining() {
    return this.surgeFor;
  }

  get powerCooldown() {
    return this.powerCooldownFor;
  }

  /** True during the short cue that precedes every surge. */
  get warning() {
    return !this.surging && this.powerCooldownFor <= this.windupFor;
  }

  /** The power that will fire when the countdown reaches zero. */
  get nextPower() {
    return this.powerCycle[this.powerIndex % this.powerCycle.length] ?? 'rage';
  }

  /** Spectral appearance used by the renderer during the Brume surge. */
  get misty() {
    return this.surging && this.activePower === 'brume';
  }

  update(dt, context) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    if (this.surging) {
      this.surgeFor = Math.max(0, this.surgeFor - dt);
      if (this.surgeFor === 0) {
        this.guarding = false;
        this.powerCooldownFor = this.powerInterval;
      }
    } else {
      this.powerCooldownFor = Math.max(0, this.powerCooldownFor - dt);
      if (this.powerCooldownFor === 0) this.beginSurge(context);
    }
    this.speed = this.surging ? this.surgeSpeed : this.huntSpeed;

    super.update(dt, context);
  }

  beginSurge(context) {
    this.surgeFor = this.powerDuration;
    this.activePower = this.nextPower;
    this.powerIndex += 1;
    this.guarding = this.activePower === 'pacte';

    if (this.activePower === 'eclair' && context?.goal) {
      this.blinkToward(context.goal, 4);
    }
  }

  chooseDirection(context) {
    const goal = context?.goal;
    const protect = context?.protect;
    const target = this.guarding && protect ? protect : goal;
    const options = walkableNeighbors(this.maze, this.col, this.row);
    if (!options.length) {
      this.direction = null;
      return;
    }

    if (!target) {
      this.wander(options);
      return;
    }

    const field = this.fieldFor(target);

    // The Oath surge ends with Victor standing guard beside the protected
    // person instead of following the Creature.
    if (this.guarding && fieldDistance(field, this.maze, this.col, this.row) <= 1) {
      this.direction = null;
      return;
    }

    let best = Infinity;
    const bestDirections = [];

    for (const direction of options) {
      const distance = fieldDistance(
        field,
        this.maze,
        this.col + direction.x,
        this.row + direction.y,
      );
      if (distance < 0) continue;

      // Outside the surge his tracking is a little loose; while surging he
      // commits to the shortest route without hesitation.
      const score = distance + (this.surging ? 0 : this.rng() * 0.35);
      if (score < best) {
        best = score;
        bestDirections.length = 0;
        bestDirections.push(direction);
      } else if (Math.abs(score - best) < 1e-9) {
        bestDirections.push(direction);
      }
    }

    const pool = bestDirections.length ? bestDirections : options;
    this.direction = pool[Math.floor(this.rng() * pool.length)];
  }

  /** Random legal movement when no target is known yet. */
  wander(options) {
    const straight = this.direction
      ? options.find((option) => option.name === this.direction.name)
      : null;

    if (straight && this.rng() < 0.5) {
      this.direction = straight;
      return;
    }

    const pool = this.direction
      ? options.filter((option) => option.name !== OPPOSITE[this.direction.name])
      : options;

    this.direction = pool[Math.floor(this.rng() * pool.length)] ?? options[0];
  }

  /**
   * Follow the shortest walkable route toward the target for a few tiles,
   * stopping two tiles short so the surge never teleports into contact.
   */
  blinkToward(goal, maxSteps = 4) {
    const field = buildDistanceField(this.maze, goal);
    let col = this.col;
    let row = this.row;

    for (let step = 0; step < maxSteps; step += 1) {
      let best = null;
      for (const direction of Object.values(DIRECTIONS)) {
        const nextCol = col + direction.x;
        const nextRow = row + direction.y;
        const distance = fieldDistance(field, this.maze, nextCol, nextRow);
        if (distance < 0) continue;
        if (!best || distance < best.distance) {
          best = { col: nextCol, row: nextRow, distance };
        }
      }

      if (!best || best.distance <= 2) break;
      col = best.col;
      row = best.row;
    }

    if (col === this.col && row === this.row) return false;

    const from = Object.freeze({ x: this.x, y: this.y });
    this.teleportTo({ col, row });
    this.blinks += 1;
    this.onBlink?.(from, Object.freeze({ x: this.x, y: this.y }));
    return true;
  }

  /** BFS is cached per target tile, so it runs at most once per tile change. */
  fieldFor(goal) {
    const key = `${goal.col},${goal.row}`;
    if (this.goalKey !== key || !this.goalField) {
      this.goalField = buildDistanceField(this.maze, goal);
      this.goalKey = key;
    }
    return this.goalField;
  }

  invalidatePathing() {
    this.goalKey = null;
    this.goalField = null;
  }
}
