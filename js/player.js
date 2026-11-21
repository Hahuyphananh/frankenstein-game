import { GridActor } from './actor.js';
import { DIRECTIONS, canMove } from './maze.js';

/**
 * Victor Frankenstein. Input directions are buffered until the next tile
 * centre where the move is legal, so cornering is smooth but grid-aware.
 */
export class Player extends GridActor {
  constructor(options) {
    super(options);
    this.nextDirection = null;
  }

  reset() {
    super.reset();
    this.nextDirection = null;
  }

  /** Accepts a direction name ("left") or a direction object. */
  requestDirection(nameOrDirection) {
    const direction =
      typeof nameOrDirection === 'string' ? DIRECTIONS[nameOrDirection] : nameOrDirection;
    if (direction) this.nextDirection = direction;
  }

  chooseDirection() {
    const wanted = this.nextDirection;
    if (wanted && canMove(this.maze, this.col, this.row, wanted)) {
      this.direction = wanted;
      this.nextDirection = null;
    }
  }
}
