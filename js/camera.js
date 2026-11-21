/**
 * Camera for the maze. The windowed view fits every tile; the full view uses
 * a cover fit so the map reaches the edges of a laptop screen while keeping
 * the playable rows and columns on-screen. Positions stay in CSS pixels and
 * tile units so the renderer never has to handle device pixel ratios.
 */
export class Camera {
  constructor() {
    this.cell = 0;
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.columns = 0;
    this.rows = 0;
  }

  fit({
    viewportWidth,
    viewportHeight,
    columns,
    rows,
    maxCell = 44,
    minCell = 4,
    insets = {},
    cover = false,
    fractional = false,
  }) {
    const top = Math.max(0, insets.top ?? 0);
    const right = Math.max(0, insets.right ?? 0);
    const bottom = Math.max(0, insets.bottom ?? 0);
    const left = Math.max(0, insets.left ?? 0);

    const availableWidth = Math.max(1, viewportWidth - left - right);
    const availableHeight = Math.max(1, viewportHeight - top - bottom);
    const fitCell = Math.min(availableWidth / columns, availableHeight / rows);
    const coverCell = Math.max(availableWidth / columns, availableHeight / rows);
    const safeCell = Math.min(
      availableWidth / Math.max(1, columns - 2),
      availableHeight / Math.max(1, rows - 2),
    );
    const rawCell = cover ? Math.min(coverCell, safeCell) : fitCell;
    const cell = Math.max(
      minCell,
      Math.min(maxCell, fractional ? rawCell : Math.floor(rawCell)),
    );

    this.cell = cell;
    this.columns = columns;
    this.rows = rows;
    this.width = columns * cell;
    this.height = rows * cell;
    this.x = Math.round(left + (availableWidth - this.width) / 2);
    this.y = Math.round(top + (availableHeight - this.height) / 2);

    return this;
  }

  /** Tile units (col + 0.5 etc.) to CSS pixels. */
  toScreen(x, y) {
    return {
      x: this.x + x * this.cell,
      y: this.y + y * this.cell,
    };
  }

  centerOf(col, row) {
    return this.toScreen(col + 0.5, row + 0.5);
  }
}
