import { CREATURE_RULES } from './config.js';
import { GridActor } from './actor.js';
import { isWalkableTile, walkableNeighbors } from './maze.js';
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
 * The Creature. All tuning lives in the difficulty profile from config.js.
 *
 * Dash: a short burst of speed when the target is nearby. The profile owns
 * the cooldown (10 seconds on Normal) and, on Hard, whether the dash can
 * shatter one wall. Respawn always selects a different walkable corner.
 */
export class Creature extends GridActor {
  constructor({
    maze,
    spawn,
    profile,
    rules = CREATURE_RULES,
    rng = Math.random,
    spawnPoints = null,
  }) {
    if (!profile?.strategy) throw new Error('Creature: a strategy profile is required.');

    super({ maze, spawn, speed: profile.speed });
    this.profile = profile;
    this.rules = rules;
    this.rng = rng;
    this.maxLives = rules.lives;
    this.lives = rules.lives;
    this.invulnerableFor = 0;
    this.baseSpeed = profile.speed;
    this.spawnPoints = Object.freeze(
      (spawnPoints?.length ? spawnPoints : [spawn]).map((tile) =>
        Object.freeze({ col: tile.col, row: tile.row }),
      ),
    );
    this.lastRespawn = Object.freeze({ col: spawn.col, row: spawn.row });
    this.usedRespawns = new Set([`${spawn.col},${spawn.row}`]);
    this.dashFor = 0;
    this.dashCooldownFor = 0;
    this.wallBreakAvailable = Boolean(profile.destroyWalls);
  }

  reset() {
    super.reset();
    this.fieldKey = null;
    this.distanceField = null;
    this.invulnerableFor = 0;
    this.dashFor = 0;
    this.speed = this.baseSpeed ?? this.profile?.speed ?? this.speed;
    this.wallBreakAvailable = Boolean(this.profile?.destroyWalls);
  }

  get invulnerable() {
    return this.invulnerableFor > 0;
  }

  get dashing() {
    return this.dashFor > 0;
  }

  get dashCooldownRemaining() {
    return this.dashCooldownFor;
  }

  /** Distance check in tile units, shared by the collision loop. */
  touches(actor, distance = this.rules.hitDistance) {
    const dx = actor.x - this.x;
    const dy = actor.y - this.y;
    // Compare squared distances and absorb float error at the exact boundary.
    return dx * dx + dy * dy <= distance * distance + 1e-9;
  }

  /** Lose a life and reappear at a different walkable corner. */
  hit(victor = null) {
    if (this.invulnerable || this.lives <= 0) return false;

    this.lives -= 1;
    this.dashFor = 0;
    this.speed = this.baseSpeed;

    const corner = this.nextRespawnCorner(victor);
    this.teleportTo(corner);
    this.lastRespawn = Object.freeze({ col: corner.col, row: corner.row });
    this.usedRespawns.add(`${corner.col},${corner.row}`);
    this.wallBreakAvailable = Boolean(this.profile.destroyWalls);
    this.invalidatePathing();
    this.invulnerableFor = this.rules.respawnInvulnerability;
    return true;
  }

  /** Exclude the previous corner, then prefer a corner away from Victor. */
  nextRespawnCorner(victor) {
    const corners = this.spawnPoints.filter((tile) =>
      isWalkableTile(this.maze, tile.col, tile.row),
    );
    const different = corners.filter(
      (tile) =>
        (tile.col !== this.lastRespawn.col || tile.row !== this.lastRespawn.row) &&
        (tile.col !== this.col || tile.row !== this.row),
    );
    const unused = different.filter(
      (tile) => !this.usedRespawns.has(`${tile.col},${tile.row}`),
    );
    const pool = unused.length ? unused : different.length ? different : corners;
    const safe = victor
      ? pool.filter(
          (tile) =>
            Math.hypot(tile.col + 0.5 - victor.x, tile.row + 0.5 - victor.y) >= 4,
        )
      : pool;

    return pick(safe.length ? safe : pool, this.rng) ?? this.spawn;
  }

  update(dt, context) {
    if (this.invulnerableFor > 0) {
      this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
    }

    this.dashCooldownFor = Math.max(0, this.dashCooldownFor - dt);
    if (this.dashFor > 0) {
      this.dashFor = Math.max(0, this.dashFor - dt);
      this.speed = this.baseSpeed * (this.profile.dashMultiplier ?? 2);
    } else {
      this.speed = this.baseSpeed;
      if (this.canDash(context)) this.beginDash();
    }

    super.update(dt, context);
  }

  canDash(context) {
    if (!(this.profile.dashCooldown > 0) || this.dashCooldownFor > 0 || this.dashFor > 0) {
      return false;
    }

    const goal = context?.goal;
    if (!goal) return false;
    const distance = Math.hypot(goal.col + 0.5 - this.x, goal.row + 0.5 - this.y);
    return distance > 1.15 && distance <= (this.profile.dashRange ?? 7);
  }

  beginDash() {
    this.dashFor = this.profile.dashDuration ?? 0.5;
    this.dashCooldownFor = this.profile.dashCooldown;
    // A per-life wall break is armed at spawn and after a respawn, not on
    // every dash. This keeps Hard's masonry damage bounded per run.
    if (!this.profile.wallBreakPerLife) {
      this.wallBreakAvailable = Boolean(this.profile.destroyWalls);
    }
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

  /** Called after a Hard-mode wall break changes the walkable graph. */
  invalidatePathing() {
    this.fieldKey = null;
    this.distanceField = null;
  }
}
