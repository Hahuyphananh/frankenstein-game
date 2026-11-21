import { CREATURE_RULES } from './config.js';
import { GridActor } from './actor.js';
import { walkableNeighbors } from './maze.js';
import { buildDistanceField, fieldDistance, maxDistanceInRange } from './pathing.js';

const OPPOSITE = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
});

function pick(list, rng) {
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * The Creature. All tuning lives in the difficulty profile from config.js:
 *
 *   wander — slow, random but legal moves, ignores Victor
 *   evade  — flees when Victor is inside fleeRadius, otherwise wanders
 *   outwit — always maximises distance, scores escape routes with a short
 *            lookahead and penalises dead-end tiles
 *
 * Movement itself comes from GridActor, so the Creature can never enter a
 * wall or move to a non-adjacent tile.
 */
export class Creature extends GridActor {
  constructor({ maze, spawn, profile, rules = CREATURE_RULES, rng = Math.random }) {
    if (!profile?.strategy) throw new Error('Creature: a strategy profile is required.');

    super({ maze, spawn, speed: profile.speed });
    this.profile = profile;
    this.rules = rules;
    this.rng = rng;
    this.maxLives = rules.lives;
    this.lives = rules.lives;
    this.invulnerableFor = 0;
  }

  reset() {
    super.reset();
    this.fieldKey = null;
    this.distanceField = null;
    this.invulnerableFor = 0;
  }

  get invulnerable() {
    return this.invulnerableFor > 0;
  }

  /** Distance check in tile units, shared by the collision loop. */
  touches(actor, distance = this.rules.hitDistance) {
    const dx = actor.x - this.x;
    const dy = actor.y - this.y;
    // Compare squared distances and absorb float error at the exact boundary.
    return dx * dx + dy * dy <= distance * distance + 1e-9;
  }

  /** Lose a life and return to the start location, protected briefly. */
  hit() {
    if (this.invulnerable || this.lives <= 0) return false;

    this.lives -= 1;
    this.reset();
    this.invulnerableFor = this.rules.respawnInvulnerability;
    return true;
  }

  update(dt, context) {
    if (this.invulnerableFor > 0) {
      this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
    }
    super.update(dt, context);
  }

  chooseDirection(context) {
    const options = walkableNeighbors(this.maze, this.col, this.row);
    if (!options.length) {
      this.direction = null;
      return;
    }

    const victor = context?.victor ?? null;

    if (this.profile.strategy === 'outwit') this.outwit(options, victor);
    else if (this.profile.strategy === 'evade') this.evade(options, victor);
    else this.wander(options);
  }

  /** Mostly random legal movement with a bias to keep going straight. */
  wander(options) {
    const straight = this.direction
      ? options.find((option) => option.name === this.direction.name)
      : null;

    if (straight && this.rng() < this.profile.continueChance) {
      this.direction = straight;
      return;
    }

    const pool = this.direction
      ? options.filter((option) => option.name !== OPPOSITE[this.direction.name])
      : options;

    this.direction = pick(pool.length ? pool : options, this.rng);
  }

  /** Greedy escape whenever Victor is close, otherwise random wandering. */
  evade(options, victor) {
    if (!victor) {
      this.wander(options);
      return;
    }

    const field = this.distanceFieldFor(victor);
    const current = fieldDistance(field, this.maze, this.col, this.row);

    if (current < 0 || current > this.profile.fleeRadius) {
      this.wander(options);
      return;
    }

    let best = -Infinity;
    const bestDirections = [];

    for (const direction of options) {
      const distance = fieldDistance(
        field,
        this.maze,
        this.col + direction.x,
        this.row + direction.y,
      );
      if (distance < 0) continue;

      // A little jitter keeps repeated encounters from looking mechanical.
      const score = distance + this.rng() * 0.25;
      if (score > best) {
        best = score;
        bestDirections.length = 0;
        bestDirections.push(direction);
      } else if (Math.abs(score - best) < 1e-9) {
        bestDirections.push(direction);
      }
    }

    this.direction = pick(bestDirections.length ? bestDirections : options, this.rng);
  }

  /** Score every legal move by distance, escape routes, openness and risk. */
  outwit(options, victor) {
    if (!victor) {
      this.wander(options);
      return;
    }

    const field = this.distanceFieldFor(victor);
    let best = -Infinity;
    const bestDirections = [];

    for (const direction of options) {
      const nextCol = this.col + direction.x;
      const nextRow = this.row + direction.y;
      const distance = fieldDistance(field, this.maze, nextCol, nextRow);
      if (distance < 0) continue;

      const escape =
        this.profile.lookahead > 0
          ? maxDistanceInRange(
              this.maze,
              field,
              { col: nextCol, row: nextRow },
              this.profile.lookahead,
            )
          : distance;
      const openness = walkableNeighbors(this.maze, nextCol, nextRow).length;
      const deadEnd = this.profile.avoidDeadEnds && openness === 1;

      const score =
        distance * this.profile.distanceWeight +
        escape * this.profile.escapeWeight +
        openness * this.profile.opennessWeight -
        (deadEnd ? this.profile.deadEndPenalty : 0) +
        this.rng() * this.profile.jitter;

      if (score > best) {
        best = score;
        bestDirections.length = 0;
        bestDirections.push(direction);
      } else if (Math.abs(score - best) < 1e-9) {
        bestDirections.push(direction);
      }
    }

    this.direction = pick(bestDirections.length ? bestDirections : options, this.rng);
  }

  /** BFS is cached per Victor tile, so it runs once per tile change at most. */
  distanceFieldFor(victor) {
    const key = `${victor.col},${victor.row}`;
    if (this.fieldKey !== key || !this.distanceField) {
      this.distanceField = buildDistanceField(this.maze, victor);
      this.fieldKey = key;
    }
    return this.distanceField;
  }
}
