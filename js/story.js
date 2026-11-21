import { Creature } from './creature.js';
import { isWalkableTile, walkableNeighbors } from './maze.js';
import { buildDistanceField, fieldDistance } from './pathing.js';

/**
 * Story layer for the single village level.
 *
 * This module knows nothing about drawing, input, the timer or the base
 * Creature strategies. It owns William's tile, detects when the Creature
 * reaches him, and holds the two narrative outcomes. `StoryCreature` is a
 * level-specific subclass that follows the story goal; the base Creature and
 * its AI strategies are untouched.
 */

/** The village square, in the right-hand corridor. */
export const WILLIAM_TILE = Object.freeze({ col: 17, row: 7 });

export const STORY_RULES = Object.freeze({
  reachDistance: 0.64,
});

const JUSTINE_SAFE =
  'Justine Moritz is never accused. She remains safe, and no execution follows.';

const JUSTINE_TRAGEDY =
  "Justine Moritz is not touched by the Creature. She is later executed after being falsely accused of William's murder.";

export const STORY_OUTCOMES = Object.freeze({
  caught: Object.freeze({
    ending: 'caught',
    label: 'The Creature is caught',
    title: 'William is safe.',
    copy: 'Victor catches the Creature before it can reach William. The village children are called home, and the night passes without a funeral.',
    epilogue: JUSTINE_SAFE,
  }),
  william: Object.freeze({
    ending: 'william',
    label: 'Tragedy in the village',
    title: 'William is dead.',
    copy: 'The Creature reaches William in the village square before Victor can stop it. The boy does not survive the night.',
    epilogue: JUSTINE_TRAGEDY,
  }),
  timeout: Object.freeze({
    ending: 'timeout',
    label: 'Time expired',
    title: 'The Creature reaches William.',
    copy: 'Victor runs out of time, and the Creature slips through the village to William.',
    epilogue: JUSTINE_TRAGEDY,
  }),
});

export class StoryLevel {
  constructor({ maze, william = WILLIAM_TILE, rules = STORY_RULES } = {}) {
    if (!maze) throw new Error('StoryLevel: maze is required.');
    if (!isWalkableTile(maze, william.col, william.row)) {
      throw new Error('StoryLevel: William must stand on a walkable tile.');
    }

    this.william = Object.freeze({ col: william.col, row: william.row });
    this.rules = rules;
    this.resolved = false;
    this.outcome = null;
  }

  get goal() {
    return this.william;
  }

  /** Read-only proximity check; movement and collision remain in their systems. */
  creatureReachedWilliam(creature) {
    if (!creature) return false;
    const dx = creature.x - (this.william.col + 0.5);
    const dy = creature.y - (this.william.row + 0.5);
    return Math.hypot(dx, dy) <= this.rules.reachDistance;
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
 * Creature variant used only by the village level. It takes the shortest
 * walkable route to the story goal. No core Creature code is modified.
 */
export class StoryCreature extends Creature {
  constructor(options) {
    super(options);
    this.goalKey = null;
    this.goalField = null;
  }

  chooseDirection(context) {
    const goal = context?.goal;
    if (!goal) {
      super.chooseDirection(context);
      return;
    }

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

  goalFieldFor(goal) {
    const key = `${goal.col},${goal.row}`;
    if (this.goalKey !== key || !this.goalField) {
      this.goalField = buildDistanceField(this.maze, goal);
      this.goalKey = key;
    }
    return this.goalField;
  }
}
