import { Creature } from './creature.js';
import { GridActor } from './actor.js';
import {
  DIRECTIONS,
  ELIZABETH_SPAWN,
  TILE,
  isWalkableTile,
  walkableNeighbors,
} from './maze.js';
import { buildDistanceField, buildRiskField, fieldDistance } from './pathing.js';

/**
 * Story layer for the single village level.
 *
 * Elizabeth is a normal GridActor who wanders slowly and uses a BFS field
 * from the Creature to flee when it gets close. StoryCreature follows her
 * moving tile, with difficulty-specific path recognition and Victor
 * avoidance. Rendering, input, collision and the timer remain outside this
 * module.
 */

export const STORY_RULES = Object.freeze({
  reachDistance: 0.64,
  elizabethSpeed: 1.3,
  fleeRadius: 7,
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
  'Justine Moritz n’est jamais accusée. Elle reste saine et sauve, et aucune exécution n’a lieu.';

const JUSTINE_TRAGEDY =
  'Justine Moritz n’est pas tuée par la Créature. Elle est plus tard exécutée après avoir été faussement accusée du meurtre d’Elizabeth.';

export const STORY_OUTCOMES = Object.freeze({
  caught: Object.freeze({
    ending: 'caught',
    label: 'La Créature est capturée',
    title: 'Elizabeth est sauve.',
    copy: 'Victor capture la Créature avant qu’elle n’atteigne Elizabeth. Les cloches du village sonnent la fin de l’alerte, et la nuit s’achève sans funérailles.',
    epilogue: JUSTINE_SAFE,
  }),
  elizabeth: Object.freeze({
    ending: 'elizabeth',
    label: 'Tragédie au village',
    title: 'Elizabeth est morte.',
    copy: 'La Créature attrape Elizabeth dans les rues pavées avant que Victor ne puisse l’arrêter. Victor arrive trop tard pour sauver sa fiancée.',
    epilogue: JUSTINE_TRAGEDY,
  }),
  timeout: Object.freeze({
    ending: 'timeout',
    label: 'Temps écoulé',
    title: 'La Créature atteint Elizabeth.',
    copy: 'Victor manque de temps, et la Créature se glisse à travers le village jusqu’à Elizabeth.',
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
 * Village Creature: follows Elizabeth's current tile, with a difficulty
 * profile that controls path recognition and how strongly it avoids Victor.
 * On Hard it can spend one wall break per life to open a shortcut through a
 * stone block.
 */
export class StoryCreature extends Creature {
  constructor(options) {
    const { onWallBreak, ...creatureOptions } = options;
    super(creatureOptions);
    this.goalKey = null;
    this.goalField = null;
    this.victorKey = null;
    this.victorField = null;
    this.riskKey = null;
    this.riskField = null;
    this.onWallBreak = onWallBreak;
  }

  invalidatePathing() {
    super.invalidatePathing();
    this.goalKey = null;
    this.goalField = null;
    this.victorKey = null;
    this.victorField = null;
    this.riskKey = null;
    this.riskField = null;
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

    // Easy has no path recognition: it simply steps toward Elizabeth's
    // current position. Normal and Hard read the maze with a BFS field.
    if (this.profile.pathRecognition === false) {
      this.pursueDirect(options, goal);
      return;
    }

    const victor = context?.victor;
    const awareness = this.profile.victorAwareness ?? 0;
    const nearVictor =
      victor &&
      awareness > 0 &&
      Math.hypot(victor.x - this.x, victor.y - this.y) <= awareness + 2;
    const threatField = nearVictor ? this.victorFieldFor(victor) : null;
    const field = nearVictor ? this.riskFieldFor(goal, victor) : this.goalFieldFor(goal);

    // Hard and Normal refuse a step that leaves them right next to Victor
    // when another exit exists. The risk field then finds the fastest safe
    // route through the rest of the village.
    let candidates = options;
    if (threatField) {
      const minimum = this.profile.victorMinDistance ?? 0;
      const safer = options.filter((direction) => {
        const distance = fieldDistance(
          threatField,
          this.maze,
          this.col + direction.x,
          this.row + direction.y,
        );
        return distance >= minimum;
      });
      if (minimum > 0 && safer.length) candidates = safer;
    }

    let best = Infinity;
    const bestDirections = [];

    for (const direction of candidates) {
      const nextCol = this.col + direction.x;
      const nextRow = this.row + direction.y;
      const distance = fieldDistance(field, this.maze, nextCol, nextRow);
      if (distance < 0 || !Number.isFinite(distance)) continue;

      if (distance < best) {
        best = distance;
        bestDirections.length = 0;
        bestDirections.push(direction);
      } else if (Math.abs(distance - best) < 1e-9) {
        bestDirections.push(direction);
      }
    }

    const pool = bestDirections.length ? bestDirections : candidates;
    this.direction = pool[Math.floor(this.rng() * pool.length)];
  }

  /** Easy mode's deliberately simple, memoryless pursuit. */
  pursueDirect(options, goal) {
    let best = Infinity;
    const bestDirections = [];

    for (const direction of options) {
      const x = this.col + direction.x + 0.5;
      const y = this.row + direction.y + 0.5;
      const distance = Math.hypot(goal.x - x, goal.y - y);
      const score = distance - (this.direction?.name === direction.name ? 0.15 : 0);

      if (score < best) {
        best = score;
        bestDirections.length = 0;
        bestDirections.push(direction);
      } else if (Math.abs(score - best) < 1e-9) {
        bestDirections.push(direction);
      }
    }

    this.direction = pick(bestDirections.length ? bestDirections : options, this.rng);
  }

  victorFieldFor(victor) {
    const key = `${victor.col},${victor.row}`;
    if (this.victorKey !== key || !this.victorField) {
      this.victorField = buildDistanceField(this.maze, victor);
      this.victorKey = key;
    }
    return this.victorField;
  }

  /**
   * Fastest route to Elizabeth with a cost for entering streets near Victor.
   * The risk field is cached until either actor changes tile.
   */
  riskFieldFor(goal, victor) {
    const key = `${goal.col},${goal.row}|${victor.col},${victor.row}`;
    if (this.riskKey !== key || !this.riskField) {
      const threat = this.victorFieldFor(victor);
      this.riskField = buildRiskField(this.maze, goal, threat, {
        radius: this.profile.victorAwareness,
        weight: this.profile.victorAvoidWeight,
      });
      this.riskKey = key;
    }
    return this.riskField;
  }

  /**
   * Spend the one wall break granted per Hard-mode life. The closest
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
