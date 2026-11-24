/**
 * Maze data and helpers.
 *
 * The village is built from separated stone blocks with one-tile streets
 * around every block. The layout is generated anew for every run, so the
 * village changes each game while still offering multiple entrances and
 * looping routes: the Creature can circle a block instead of always taking
 * one fixed path.
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

export const DEFAULT_COLUMNS = 25;
export const DEFAULT_ROWS = 15;

/** Street lines keep every block at least two tiles thick. */
function chooseStreetLines({ min, max, rng }) {
  const lines = [];
  let position = min + Math.floor(rng() * 3);
  while (position <= max) {
    lines.push(position);
    position += 3 + (rng() < 0.3 ? 1 : 0);
  }
  return lines;
}

/**
 * Build a fresh Victorian village.
 *
 * The perimeter is always a street ring, so all four corners stay valid
 * Creature spawns and the village keeps several entrances. A random set of
 * crossing streets then splits the interior into stone blocks; some blocks
 * open into a small square or a one-tile alley, so routes loop instead of
 * forming a single corridor. Every street tile is connected by construction.
 */
export function generateMazeLayout({
  rng = Math.random,
  columns = DEFAULT_COLUMNS,
  rows = DEFAULT_ROWS,
} = {}) {
  if (columns < 11 || rows < 9) {
    throw new Error('generateMazeLayout: maze is too small.');
  }

  const grid = Array.from({ length: rows }, () => new Array(columns).fill(TILE.WALL));
  const left = 1;
  const top = 1;
  const right = columns - 2;
  const bottom = rows - 2;

  for (let col = left; col <= right; col += 1) {
    grid[top][col] = TILE.PELLET;
    grid[bottom][col] = TILE.PELLET;
  }
  for (let row = top; row <= bottom; row += 1) {
    grid[row][left] = TILE.PELLET;
    grid[row][right] = TILE.PELLET;
  }

  const streetCols = chooseStreetLines({ min: 4, max: columns - 5, rng });
  const streetRows = chooseStreetLines({ min: 4, max: rows - 5, rng });

  for (const col of streetCols) {
    for (let row = top; row <= bottom; row += 1) grid[row][col] = TILE.PELLET;
  }
  for (const row of streetRows) {
    for (let col = left; col <= right; col += 1) grid[row][col] = TILE.PELLET;
  }

  const colEdges = [left, ...streetCols, right];
  const rowEdges = [top, ...streetRows, bottom];

  for (let ci = 0; ci < colEdges.length - 1; ci += 1) {
    for (let ri = 0; ri < rowEdges.length - 1; ri += 1) {
      const startCol = colEdges[ci] + 1;
      const endCol = colEdges[ci + 1] - 1;
      const startRow = rowEdges[ri] + 1;
      const endRow = rowEdges[ri + 1] - 1;
      const width = endCol - startCol + 1;
      const height = endRow - startRow + 1;
      if (width < 2 || height < 2) continue;

      const roll = rng();
      if (roll < 0.14) {
        // A small square joins the streets around the block.
        for (let row = startRow; row <= endRow; row += 1) {
          for (let col = startCol; col <= endCol; col += 1) grid[row][col] = TILE.PELLET;
        }
      } else if (roll < 0.5) {
        // A one-tile alley cuts through the block as an extra route.
        if (rng() < 0.5) {
          const row = startRow + Math.floor(rng() * height);
          for (let col = startCol; col <= endCol; col += 1) grid[row][col] = TILE.PELLET;
        } else {
          const col = startCol + Math.floor(rng() * width);
          for (let row = startRow; row <= endRow; row += 1) grid[row][col] = TILE.PELLET;
        }
      }
    }
  }

  return grid.map((cells) => cells.join(''));
}

/** Deterministic random source so the reusable village pool survives reloads. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const MAP_SEEDS = Object.freeze([
  0x9e3779b9,
  0x243f6a88,
  0xb7e15162,
  0xdeadbeef,
  0x12345678,
  0x0badf00d,
  0xc0ffee,
  0xfeedface,
]);

/** Eight stable villages, generated once and reused across runs. */
export const MAP_POOL = Object.freeze(
  MAP_SEEDS.map((seed, index) => {
    const layout = Object.freeze(generateMazeLayout({ rng: seededRandom(seed) }));
    return Object.freeze({
      id: `village-${index + 1}`,
      label: `Village ${index + 1}`,
      layout,
    });
  }),
);

const VALID_TILES = new Set(Object.values(TILE));

export function buildMaze(layout = generateMazeLayout()) {
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
    pickTile(targetPool.length ? targetPool : relaxedTargets, rng) ??
    pickTile(streets, rng) ??
    ELIZABETH_SPAWN;

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
  const victor =
    pickTile(victorPool.length ? victorPool : relaxedVictors, rng) ??
    pickTile(streets, rng) ??
    PLAYER_SPAWN;

  return Object.freeze({ creature, victor, elizabeth });
}

/**
 * Hunt placement: Elizabeth is close to the Creature's corner and Victor is
 * placed far enough away that the chase starts with room to move.
 */
export function chooseHuntStartPositions(maze, { rng = Math.random, previous = null } = {}) {
  const corners = CORNER_SPAWNS.filter((tile) => isWalkableTile(maze, tile.col, tile.row));
  const streets = walkableTiles(maze);

  const targetPool = streets.filter((tile) => !sameTile(tile, previous?.elizabeth));
  const elizabeth =
    pickTile(targetPool.length ? targetPool : streets, rng) ??
    pickTile(streets, rng) ??
    ELIZABETH_SPAWN;

  // The Creature starts in one of the corners farthest from the protected
  // person, so every run opens with a chase across the village.
  const rankedCorners = [...corners].sort(
    (a, b) => manhattan(b, elizabeth) - manhattan(a, elizabeth),
  );
  const startCorners = rankedCorners.slice(0, 2);
  const freshCorners = startCorners.filter((tile) => !sameTile(tile, previous?.creature));
  const creature =
    pickTile(freshCorners.length ? freshCorners : startCorners, rng) ??
    pickTile(corners, rng) ??
    CREATURE_SPAWN;

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
  const victor =
    pickTile(victorPool.length ? victorPool : relaxedVictors, rng) ??
    pickTile(streets, rng) ??
    PLAYER_SPAWN;

  return Object.freeze({ creature, victor, elizabeth });
}

/** Load a generated layout into the shared, long-lived maze object. */
export function restoreMaze(maze, layout) {
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

/** The renderer and game share one maze object; each run rewrites its tiles. */
export const MAZE = buildMaze(MAP_POOL[0].layout);
