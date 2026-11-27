import { GridActor } from './actor.js';
import {
  VICTOR_POWER,
  VICTOR_POWER_CYCLE,
  VICTOR_POWER_EFFECTS,
} from './config.js';
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
 * lower speed than the player. He is always under exactly one of his four
 * powers and switches to the next when the current phase expires:
 *
 *   rage    pure pursuit at top speed ("maddening rage")
 *   eclair  blinks several tiles toward the Creature (the spark of life)
 *   brume   vanishes completely for a shorter phase (the mists where the
 *           Creature appears)
 *   pacte   runs to guard the protected person (his vow to Elizabeth)
 */
export class VictorHunter extends GridActor {
  constructor({
    maze,
    spawn,
    speed,
    surgeSpeed,
    power = VICTOR_POWER,
    powerCycle = VICTOR_POWER_CYCLE,
    powerEffects = VICTOR_POWER_EFFECTS,
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
    this.powerEffects = powerEffects;
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
    // GridActor's constructor calls reset() before Victor's own fields are
    // assigned, so every read here must tolerate the first, incomplete pass.
    this.powerCooldownFor = 0;
    this.powerIndex = 1;
    this.activePower = this.powerCycle?.[0] ?? 'rage';
    this.guarding = this.activePower === 'pacte';
    this.blinks = 0;
    const effect = this.powerEffects?.[this.activePower] ?? {};
    this.powerSpeedScale = effect.speedScale ?? 1;
    this.surgeFor =
      this.powerDuration !== undefined
        ? this.powerDuration * (effect.durationScale ?? 1)
        : 0;
    if (this.huntSpeed !== undefined) this.speed = this.speedForPower();
  }

  get surging() {
    return this.surgeFor > 0;
  }

  get surgeRemaining() {
    return this.surgeFor;
  }

  get powerCooldown() {
    return 0;
  }

  /** There is no idle window any more; a power is always active. */
  get warning() {
    return false;
  }

  /** The power that takes over when the current phase ends. */
  get nextPower() {
    return this.powerCycle[this.powerIndex % this.powerCycle.length] ?? 'rage';
  }

  /** Brume is the only phase where Victor disappears completely. */
  get invisible() {
    return this.activePower === 'brume';
  }

  /** Phase length of the active power; Brume is shorter than the rest. */
  get activePowerDuration() {
    const effect = this.powerEffects?.[this.activePower] ?? {};
    return this.powerDuration * (effect.durationScale ?? 1);
  }

  update(dt, context) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    this.surgeFor = Math.max(0, this.surgeFor - dt);
    if (this.surgeFor === 0) this.advancePower(context);
    this.speed = this.speedForPower();

    super.update(dt, context);
  }

  /** Rage is the only power that pushes Victor past his surge speed. */
  speedForPower() {
    if (this.activePower === 'rage') return this.surgeSpeed * this.powerSpeedScale;
    return this.huntSpeed * this.powerSpeedScale;
  }

  advancePower(context) {
    this.activePower = this.nextPower;
    this.powerIndex += 1;
    this.guarding = this.activePower === 'pacte';

    const effect = this.powerEffects[this.activePower] ?? {};
    this.powerSpeedScale = effect.speedScale ?? 1;
    this.surgeFor = this.powerDuration * (effect.durationScale ?? 1);

    if (this.activePower === 'eclair' && context?.goal) {
      this.blinkToward(
        context.goal,
        effect.blinkSteps ?? 3,
        effect.blinkStop ?? 3,
      );
    }
  }

  chooseDirection(context) {
    const goal = context?.goal;
    const guard = this.guarding ? context?.protect ?? null : null;
    const intercepts = Boolean(guard && goal) && this.withinGuardReach(goal, guard);
    const target = intercepts ? goal : guard ?? goal;
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

    // Out of reach he stands guard beside the protected person instead of
    // following the Creature; inside guardRadius he leaves the post to cut
    // the Creature off.
    if (guard && !intercepts && fieldDistance(field, this.maze, this.col, this.row) <= 1) {
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

      // Victor always commits to the shortest route without hesitation.
      const score = distance;
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

  /** True when the Creature is close enough to the protected person to strike. */
  withinGuardReach(goal, guard) {
    const radius = this.powerEffects.pacte?.guardRadius ?? 0;
    if (!(radius > 0)) return false;
    return Math.hypot(goal.x - guard.x, goal.y - guard.y) <= radius;
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
   * stopping several tiles short so the surge never teleports into contact.
   */
  blinkToward(goal, maxSteps = 3, stopDistance = 3) {
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

      if (!best || best.distance <= stopDistance) break;
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
