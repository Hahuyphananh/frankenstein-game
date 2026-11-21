import { DIRECTIONS, isWalkableTile } from './maze.js';

/**
 * Lightweight grid pathing helpers used by the Creature AI.
 * BFS over a 21×15 maze is a few hundred nodes, so fields are cheap to build
 * and are cached by the caller per Victor tile.
 */

const CARDINALS = Object.values(DIRECTIONS);

export function buildDistanceField(maze, origin) {
  const size = maze.columns * maze.rows;
  const distances = new Int16Array(size).fill(-1);

  if (!isWalkableTile(maze, origin.col, origin.row)) return distances;

  const start = origin.row * maze.columns + origin.col;
  distances[start] = 0;
  const queue = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const col = index % maze.columns;
    const row = (index - col) / maze.columns;
    const nextDistance = distances[index] + 1;

    for (const direction of CARDINALS) {
      const nextCol = col + direction.x;
      const nextRow = row + direction.y;
      if (!isWalkableTile(maze, nextCol, nextRow)) continue;

      const nextIndex = nextRow * maze.columns + nextCol;
      if (distances[nextIndex] !== -1) continue;

      distances[nextIndex] = nextDistance;
      queue.push(nextIndex);
    }
  }

  return distances;
}

export function fieldDistance(field, maze, col, row) {
  if (!isWalkableTile(maze, col, row)) return -1;
  return field[row * maze.columns + col];
}

/**
 * Highest distance-from-origin value reachable within `depth` steps of a
 * tile. Used to judge whether a candidate move leads to an escape route or
 * into a pocket.
 */
export function maxDistanceInRange(maze, field, start, depth) {
  if (depth <= 0) return fieldDistance(field, maze, start.col, start.row);

  const visited = new Uint8Array(field.length);
  const startIndex = start.row * maze.columns + start.col;
  if (field[startIndex] < 0) return -1;

  visited[startIndex] = 1;
  let best = field[startIndex];
  let frontier = [startIndex];

  for (let step = 0; step < depth && frontier.length; step += 1) {
    const nextFrontier = [];

    for (const index of frontier) {
      const col = index % maze.columns;
      const row = (index - col) / maze.columns;

      for (const direction of CARDINALS) {
        const nextCol = col + direction.x;
        const nextRow = row + direction.y;
        if (!isWalkableTile(maze, nextCol, nextRow)) continue;

        const nextIndex = nextRow * maze.columns + nextCol;
        if (visited[nextIndex] || field[nextIndex] < 0) continue;

        visited[nextIndex] = 1;
        if (field[nextIndex] > best) best = field[nextIndex];
        nextFrontier.push(nextIndex);
      }
    }

    frontier = nextFrontier;
  }

  return best;
}
