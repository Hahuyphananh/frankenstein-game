/**
 * Maze data and helpers.
 *
 * The layout is plain ASCII so it stays readable and editable:
 *   #  wall      .  bolt (pellet)      o  power cell      (space) empty
 *
 * Gameplay will consume the parsed tile grid; the renderer already draws it.
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

/** A central corridor tile in the lower half of the maze. */
export const PLAYER_SPAWN = Object.freeze({ col: 10, row: 12 });

/** Top-left corner of the maze, far from Victor's spawn. */
export const CREATURE_SPAWN = Object.freeze({ col: 1, row: 1 });

export const MAZE_LAYOUT = Object.freeze([
  '#####################',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#o#.......#.......#o#',
  '#.#.###.#####.###.#.#',
  '#...#...#...#...#...#',
  '###.#.#.###.#.#.#.###',
  '#.....#...#...#.....#',
  '#.###.#.#####.#.###.#',
  '#o........#........o#',
  '#...#...#...#...#...#',
  '#.###.###.#.###.###.#',
  '#.....#.......#.....#',
  '#.###.#.#####.#.###.#',
  '#####################',
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

export const MAZE = buildMaze();
