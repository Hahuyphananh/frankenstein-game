/**
 * Maze data and helpers.
 *
 * The village is built from separated stone blocks with one-tile streets
 * around every block. That deliberately creates multiple looping routes, so
 * the Creature can circle a block instead of always taking one fixed path.
 *
 * Layout symbols:
 *   #  wall      .  cobbled street
 */

export const TILE = Object.freeze({
  WALL: '#',
  PELLET: '.',
  POWER: 'o',
  EMPTY: ' ',
});

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, name: 'up' }),
  down: Object.freeze({ x: 0, y: 1, name: 'down' }),
  left: Object.freeze({ x: -1, y: 0, name: 'left' }),
  right: Object.freeze({ x: 1, y: 0, name: 'right' }),
});

/** Bottom street, central enough to give Victor a fair start. */
export const PLAYER_SPAWN = Object.freeze({ col: 12, row: 13 });

/** Elizabeth starts on the upper central street. */
export const ELIZABETH_SPAWN = Object.freeze({ col: 12, row: 4 });

/** All four village corners are streets and valid Creature spawns. */
export const CORNER_SPAWNS = Object.freeze([
  Object.freeze({ col: 1, row: 1 }),
  Object.freeze({ col: 23, row: 1 }),
  Object.freeze({ col: 1, row: 13 }),
  Object.freeze({ col: 23, row: 13 }),
]);

export const CREATURE_SPAWN = CORNER_SPAWNS[0];

export const MAZE_LAYOUT = Object.freeze([
  '#########################',
  '#.......................#',
  '#.##.##.##.##.##.##.##..#',
  '#.##.##.##.##.##.##.##..#',
  '#.......................#',
  '#.##.##.##.##.##.##.##..#',
  '#.##.##.##.##.##.##.##..#',
  '#.......................#',
  '#.##.##.##.##.##.##.##..#',
  '#.##.##.##.##.##.##.##..#',
  '#.......................#',
  '#.##.##.##.##.##.##.##..#',
  '#.##.##.##.##.##.##.##..#',
  '#.......................#',
  '#########################',
]);

const VALID_TILES = new Set(Object.values(TILE));

export function buildMaze(layout = MAZE_LAYOUT) {
  const tiles = layout.map((row, index) => {
    if (row.length !== layout[0].length) {
      throw new Error(`Maze row ${index} has ${row.length} columns, expected ${layout[0].length}.`);
    }
    const cells = [...row];
    for (const cell of cells) {
      if (!VALID_TILES.has(cell)) {
        throw new Error(`Unknown maze tile "${cell}" on row ${index}.`);
      }
    }
    return cells;
  });

  return Object.freeze({
    columns: tiles[0].length,
    rows: tiles.length,
    tiles,
  });
}

export function isWalkableTile(maze, col, row) {
  if (row < 0 || row >= maze.rows || col < 0 || col >= maze.columns) return false;
  return maze.tiles[row][col] !== TILE.WALL;
}

export function canMove(maze, col, row, direction) {
  if (!direction) return false;
  return isWalkableTile(maze, col + direction.x, row + direction.y);
}

export function walkableNeighbors(maze, col, row) {
  return Object.values(DIRECTIONS).filter((direction) =>
    canMove(maze, col, row, direction),
  );
}

/** Every street tile, used for the randomised opening positions. */
export function walkableTiles(maze) {
  const tiles = [];
  for (let row = 0; row < maze.rows; row += 1) {
    for (let col = 0; col < maze.columns; col += 1) {
      if (isWalkableTile(maze, col, row)) tiles.push(Object.freeze({ col, row }));
    }
  }
  return tiles;
}

function manhattan(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function sameTile(a, b) {
  return Boolean(a && b && a.col === b.col && a.row === b.row);
}

function pickTile(pool, rng) {
  if (!pool.length) return null;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index];
}

/**
 * Pick a fresh corner, street and street for the three actors. The previous
 * run's positions are excluded when alternatives exist, so Restart never
 * opens in exactly the same arrangement twice.
 */
export function chooseStartPositions(maze, { rng = Math.random, previous = null } = {}) {
  const corners = CORNER_SPAWNS.filter((tile) => isWalkableTile(maze, tile.col, tile.row));
  const streets = walkableTiles(maze);

  const freshCorners = corners.filter((tile) => !sameTile(tile, previous?.creature));
  const creature = pickTile(freshCorners.length ? freshCorners : corners, rng) ?? CREATURE_SPAWN;

  const targetPool = streets.filter(
    (tile) =>
      !sameTile(tile, creature) &&
      !sameTile(tile, previous?.elizabeth) &&
      manhattan(tile, creature) >= 10,
  );
  const relaxedTargets = streets.filter(
    (tile) => !sameTile(tile, creature) && !sameTile(tile, previous?.elizabeth),
  );
  const elizabeth =
    pickTile(targetPool.length ? targetPool : relaxedTargets, rng) ?? ELIZABETH_SPAWN;

  const victorPool = streets.filter(
    (tile) =>
      !sameTile(tile, creature) &&
      !sameTile(tile, elizabeth) &&
      !sameTile(tile, previous?.victor) &&
      manhattan(tile, creature) >= 6 &&
      manhattan(tile, elizabeth) >= 5,
  );
  const relaxedVictors = streets.filter(
    (tile) =>
      !sameTile(tile, creature) &&
      !sameTile(tile, elizabeth) &&
      !sameTile(tile, previous?.victor),
  );
  const victor = pickTile(victorPool.length ? victorPool : relaxedVictors, rng) ?? PLAYER_SPAWN;

  return Object.freeze({ creature, victor, elizabeth });
}

/**
 * Duel placement: Elizabeth is close to the Creature's corner and Victor is
 * placed far enough away that both players have a meaningful race.
 */
export function chooseDuelStartPositions(maze, { rng = Math.random, previous = null } = {}) {
  const corners = CORNER_SPAWNS.filter((tile) => isWalkableTile(maze, tile.col, tile.row));
  const streets = walkableTiles(maze);

  const targetPool = streets.filter((tile) => !sameTile(tile, previous?.elizabeth));
  const elizabeth =
    pickTile(targetPool.length ? targetPool : streets, rng) ?? ELIZABETH_SPAWN;

  const nearestCorners = [...corners].sort(
    (a, b) => manhattan(a, elizabeth) - manhattan(b, elizabeth),
  );
  const freshCorners = nearestCorners
    .slice(0, 2)
    .filter((tile) => !sameTile(tile, previous?.creature));
  const creature =
    pickTile(freshCorners.length ? freshCorners : nearestCorners, rng) ?? CREATURE_SPAWN;

  const victorPool = streets.filter(
    (tile) =>
      !sameTile(tile, creature) &&
      !sameTile(tile, elizabeth) &&
      !sameTile(tile, previous?.victor) &&
      manhattan(tile, creature) >= 12 &&
      manhattan(tile, elizabeth) >= 5,
  );
  const relaxedVictors = streets.filter(
    (tile) =>
      !sameTile(tile, creature) &&
      !sameTile(tile, elizabeth) &&
      manhattan(tile, creature) >= 10,
  );
  const victor = pickTile(victorPool.length ? victorPool : relaxedVictors, rng) ?? PLAYER_SPAWN;

  return Object.freeze({ creature, victor, elizabeth });
}

export function restoreMaze(maze, layout = MAZE_LAYOUT) {
  if (!maze || layout.length !== maze.rows) {
    throw new Error('restoreMaze: layout does not match the maze.');
  }
  layout.forEach((row, index) => {
    if (row.length !== maze.columns) {
      throw new Error(`restoreMaze: row ${index} has the wrong width.`);
    }
    maze.tiles[index].splice(0, maze.columns, ...row);
  });
  return maze;
}

export const MAZE = buildMaze();
