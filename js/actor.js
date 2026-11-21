import { canMove, isWalkableTile } from './maze.js';

const EPSILON = 1e-6;
const MAX_STEPS = 8;

/**
 * Shared movement for anything that walks the maze grid.
 *
 * An actor is always either centred on a tile or travelling between two
 * adjacent tile centres. It only ever commits to an adjacent walkable tile,
 * so walls cannot be entered and positions never jump. Subclasses decide the
 * next direction at tile centres via chooseDirection().
 */
export class GridActor {
  constructor({ maze, spawn, speed = 5 }) {
    if (!maze || !spawn) throw new Error('GridActor: maze and spawn are required.');
    if (!isWalkableTile(maze, spawn.col, spawn.row)) {
      throw new Error('GridActor: spawn tile is inside a wall.');
    }

    this.maze = maze;
    this.spawn = Object.freeze({ col: spawn.col, row: spawn.row });
    this.speed = speed;
    this.reset();
  }

  reset() {
    this.col = this.spawn.col;
    this.row = this.spawn.row;
    this.offset = 0;
    this.direction = null;
    this.moving = false;
    this.facing = 'right';
    this.animTime = 0;
  }

  /** Position in tile units (0.5 is a tile centre). */
  get x() {
    return this.col + 0.5 + (this.direction ? this.direction.x * this.offset : 0);
  }

  get y() {
    return this.row + 0.5 + (this.direction ? this.direction.y * this.offset : 0);
  }

  /**
   * Called at each tile centre. Subclasses may set `this.direction`; leaving
   * it unchanged continues straight when the way ahead is open.
   */
  chooseDirection(_context) {}

  update(dt, context) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    let remaining = this.speed * dt;
    this.animTime += dt;
    this.moving = false;

    for (let step = 0; step < MAX_STEPS && remaining > EPSILON; step += 1) {
      if (this.offset <= EPSILON) {
        this.offset = 0;
        this.chooseDirection(context);

        if (!this.direction || !canMove(this.maze, this.col, this.row, this.direction)) {
          this.direction = null;
          break;
        }
      }

      const distance = 1 - this.offset;
      if (remaining >= distance) {
        remaining -= distance;
        this.offset = 0;
        this.col += this.direction.x;
        this.row += this.direction.y;
        this.moving = true;
      } else {
        this.offset += remaining;
        remaining = 0;
        this.moving = true;
      }
    }

    if (this.direction && this.direction.x !== 0) {
      this.facing = this.direction.x > 0 ? 'right' : 'left';
    }
  }
}
