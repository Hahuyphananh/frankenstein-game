import { Creature } from './creature.js';
import { GridActor } from './actor.js';
import {
  DIRECTIONS,
  ELIZABETH_SPAWN,
  TILE,
  isWalkableTile,
  walkableNeighbors,
} from './maze.js';
import { buildDistanceField, fieldDistance } from './pathing.js';

/**
 * Story layer for the single village level.
 *
 * Elizabeth is a normal GridActor who wanders slowly and uses a BFS field
 * from the Creature to flee when it gets close. StoryCreature follows her
 * moving tile. Rendering, input, collision and the timer remain outside this
 * module.
 */

export const STORY_RULES = Object.freeze({
  reachDistance: 0.64,
  elizabethSpeed: 1.1,
  fleeRadius: 5.5,
  wanderContinueChance: 0.55,
});

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

const JUSTINE_SAFE =
  'Justine Moritz is never accused. She remains safe, and no execution follows.';

const JUSTINE_TRAGEDY =
  "Justine Moritz is not touched by the Creature. She is later executed after being falsely accused of Elizabeth's murder.";

export const STORY_OUTCOMES = Object.freeze({
  caught: Object.freeze({
    ending: 'caught',
    label: 'The Creature is caught',
    title: 'Elizabeth is safe.',
    copy: 'Victor catches the Creature before it can reach Elizabeth. The village bells ring the all-clear, and the night passes without a funeral.',
    epilogue: JUSTINE_SAFE,
  }),
  elizabeth: Object.freeze({
    ending: 'elizabeth',
    label: 'Tragedy in the village',
    title: 'Elizabeth is dead.',
    copy: 'The Creature catches Elizabeth on the cobbled streets before Victor can stop it. Victor arrives too late to save his bride.',
    epilogue: JUSTINE_TRAGEDY,
  }),
  timeout: Object.freeze({
    ending: 'timeout',
    label: 'Time expired',
    title: 'The Creature reaches Elizabeth.',
    copy: 'Victor runs out of time, and the Creature slips through the village to Elizabeth.',
    epilogue: JUSTINE_TRAGEDY,
  }),
});

/** Elizabeth's small, cautious movement loop. */
export class Elizabeth extends GridActor {
  constructor({ maze, spawn = ELIZABETH_SPAWN, speed = STORY_RULES.elizabethSpeed, rng = Math.random }) {
    super({ maze, spawn, speed });
    this.rng = rng;
    this.fieldKey = null;
    this.creatureField = null;
  }

  chooseDirection(context) {
    const options = walkableNeighbors(this.maze, this.col, this.row);
    if (!options.length) {
      this.direction = null;
      return;
    }

    const creature = context?.creature;
    if (creature && this.distanceTo(creature) <= STORY_RULES.fleeRadius) {
      this.flee(options, creature);
      return;
    }

    this.wander(options);
  }

  distanceTo(actor) {
    return Math.hypot(actor.x - this.x, actor.y - this.y);
  }

  /** Pick the legal move that puts the most walkable distance behind her. */
  flee(options, creature) {
    const field = this.fieldFor(creature);
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

      const score = distance + this.rng() * 0.3;
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

  wander(options) {
    const straight = this.direction
      ? options.find((option) => option.name === this.direction.name)
      : null;

    if (straight && this.rng() < STORY_RULES.wanderContinueChance) {
      this.direction = straight;
      return;
    }

    const pool = this.direction
      ? options.filter((option) => option.name !== OPPOSITE[this.direction.name])
      : options;

    this.direction = pick(pool.length ? pool : options, this.rng);
  }

  fieldFor(creature) {
    const key = `${creature.col},${creature.row}`;
    if (this.fieldKey !== key || !this.creatureField) {
      this.creatureField = buildDistanceField(this.maze, creature);
      this.fieldKey = key;
    }
    return this.creatureField;
  }

  invalidatePathing() {
    this.fieldKey = null;
    this.creatureField = null;
  }
}

export class StoryLevel {
  constructor({ maze, elizabeth = ELIZABETH_SPAWN, rules = STORY_RULES, rng = Math.random } = {}) {
    if (!maze) throw new Error('StoryLevel: maze is required.');
    if (!isWalkableTile(maze, elizabeth.col, elizabeth.row)) {
      throw new Error('StoryLevel: Elizabeth must start on a walkable tile.');
    }

    this.rules = rules;
    this.elizabeth = new Elizabeth({
      maze,
      spawn: elizabeth,
      speed: rules.elizabethSpeed,
      rng,
    });
    this.resolved = false;
    this.outcome = null;
  }

  get goal() {
    return this.elizabeth;
  }

  update(dt, context) {
    if (!this.resolved) this.elizabeth.update(dt, context);
  }

  /** Read-only proximity check; movement and collision remain separate. */
  creatureReachedElizabeth(creature) {
    if (!creature || this.resolved) return false;
    const dx = creature.x - this.elizabeth.x;
    const dy = creature.y - this.elizabeth.y;
    return Math.hypot(dx, dy) <= this.rules.reachDistance;
  }

  invalidatePathing() {
    this.elizabeth.invalidatePathing();
  }

  /** First ending wins, so a level can never resolve twice. */
  resolve(ending) {
    if (this.resolved) return this.outcome;

    const outcome = STORY_OUTCOMES[ending];
    if (!outcome) throw new Error(`StoryLevel: unknown ending "${ending}".`);

    this.outcome = outcome;
    this.resolved = true;
    return outcome;
  }
}

/**
 * Village Creature: follows Elizabeth's current tile, and on Hard can spend
 * one wall break per dash to open a shortcut through a stone block.
 */
export class StoryCreature extends Creature {
  constructor(options) {
    const { onWallBreak, ...creatureOptions } = options;
    super(creatureOptions);
    this.goalKey = null;
    this.goalField = null;
    this.onWallBreak = onWallBreak;
  }

  invalidatePathing() {
    super.invalidatePathing();
    this.goalKey = null;
    this.goalField = null;
  }

  chooseDirection(context) {
    const goal = context?.goal;
    if (!goal) {
      super.chooseDirection(context);
      return;
    }

    if (this.tryBreakWall(context)) return;

    const options = walkableNeighbors(this.maze, this.col, this.row);
    if (!options.length) {
      this.direction = null;
      return;
    }

    const field = this.goalFieldFor(goal);
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

      if (distance < best) {
        best = distance;
        bestDirections.length = 0;
        bestDirections.push(direction);
      } else if (distance === best) {
        bestDirections.push(direction);
      }
    }

    const pool = bestDirections.length ? bestDirections : options;
    this.direction = pool[Math.floor(this.rng() * pool.length)];
  }

  /**
   * Spend the one wall break granted by a Hard-mode dash. The closest
   * breakable wall to Elizabeth wins, which keeps the shortcut purposeful.
   */
  tryBreakWall(context) {
    if (!this.dashing || !this.profile.destroyWalls || !this.wallBreakAvailable) {
      return false;
    }

    const goal = context?.goal;
    if (!goal) return false;

    const walls = [];
    for (const direction of Object.values(DIRECTIONS)) {
      const col = this.col + direction.x;
      const row = this.row + direction.y;
      if (
        col <= 0 ||
        row <= 0 ||
        col >= this.maze.columns - 1 ||
        row >= this.maze.rows - 1 ||
        this.maze.tiles[row][col] !== TILE.WALL
      ) {
        continue;
      }

      walls.push({
        col,
        row,
        direction,
        score: Math.abs(goal.col - col) + Math.abs(goal.row - row),
      });
    }

    if (!walls.length) return false;

    walls.sort((a, b) => a.score - b.score);
    const wall = walls[0];
    this.maze.tiles[wall.row][wall.col] = TILE.EMPTY;
    this.wallBreakAvailable = false;
    this.direction = wall.direction;
    this.invalidatePathing();
    this.onWallBreak?.({ col: wall.col, row: wall.row });
    return true;
  }

  goalFieldFor(goal) {
    const key = `${goal.col},${goal.row}`;
    if (this.goalKey !== key || !this.goalField) {
      this.goalField = buildDistanceField(this.maze, goal);
      this.goalKey = key;
    }
    return this.goalField;
  }
}
