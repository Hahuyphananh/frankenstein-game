import { Camera } from './camera.js';
import { TILE } from './maze.js';
import { drawCreature, drawElizabeth, drawVictor } from './sprites.js';

const TAU = Math.PI * 2;

/** Wall-mounted gas lamps: all are solid wall tiles beside walkable floor. */
const LAMPS = Object.freeze([
  { col: 2, row: 2, phase: 0.2 },
  { col: 8, row: 2, phase: 1.4 },
  { col: 14, row: 2, phase: 2.6 },
  { col: 20, row: 2, phase: 3.3 },
  { col: 2, row: 11, phase: 1.8 },
  { col: 8, row: 11, phase: 4.4 },
  { col: 14, row: 11, phase: 0.9 },
  { col: 20, row: 11, phase: 3.8 },
]);

function noise(a, b, salt = 0) {
  let value = (a * 374761393 + b * 668265263 + salt * 2147483647) >>> 0;
  value = ((value ^ (value >>> 13)) * 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

/**
 * Canvas renderer: moonlit stone maze, cobbled streets, gaslight, pixel actors
 * and short-lived hit effects. It never mutates actors or game state.
 */
export class StageRenderer {
  constructor(canvas, { maze } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('StageRenderer: canvas required.');
    if (!maze) throw new Error('StageRenderer: maze required.');

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.maze = maze;
    this.screen = 'menu';
    this.mapLayout = 'full';
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.camera = new Camera();
    this.player = null;
    this.creature = null;
    this.story = null;
    this.playerFacing = 'down';
    this.creatureFacing = 'down';
    this.elizabethFacing = 'down';
    this.backdrop = null;
    this.floorLayer = null;
    this.wallLayer = null;
    this.effects = [];
    this.flash = 0;
    this.damage = 0;
    this.arcs = [];
    this.arcClock = 2.2;
    this.time = 0;
    this.animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.wallCells = [];
    maze.tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (tile === TILE.WALL) this.wallCells.push({ c, r });
      });
    });
    this.lampCells = LAMPS.filter(
      (lamp) => this.maze.tiles[lamp.row]?.[lamp.col] === TILE.WALL,
    );

    this.particles = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.5 + Math.random() * 1.8,
      speed: 0.008 + Math.random() * 0.02,
      sway: 8 + Math.random() * 20,
      phase: Math.random() * TAU,
    }));

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  setScreen(screen) {
    if (screen !== 'menu' && screen !== 'stage') return;
    if (this.screen === screen) return;
    this.screen = screen;
    this.computeCamera();
    this.buildFloorLayer();
    this.buildWallLayer();
  }

  /** Switch between the immersive viewport map and a windowed stage. */
  setMapLayout(layout) {
    if (layout !== 'full' && layout !== 'windowed') return;
    if (this.mapLayout === layout) return;
    this.mapLayout = layout;
    this.computeCamera();
    this.buildFloorLayer();
    this.buildWallLayer();
  }

  /** Rebuild terrain after a Hard-mode wall break. */
  refreshMaze() {
    this.wallCells = [];
    this.maze.tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (tile === TILE.WALL) this.wallCells.push({ c, r });
      });
    });
    this.lampCells = LAMPS.filter(
      (lamp) => this.maze.tiles[lamp.row]?.[lamp.col] === TILE.WALL,
    );
    this.buildFloorLayer();
    this.buildWallLayer();
  }

  setPlayer(player) {
    this.player = player;
  }

  setCreature(creature) {
    this.creature = creature;
  }

  setStory(story) {
    this.story = story;
  }

  /** Visual burst at a collision point, in tile units. */
  catchEffect(x, y, { final = false } = {}) {
    const count = final ? 26 : 12;
    const sparks = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * TAU + Math.random() * 0.5;
      const speed = 1.1 + Math.random() * (final ? 3.4 : 2.3);
      return {
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        size: 1 + Math.floor(Math.random() * 3),
      };
    });

    this.effects.push({
      x,
      y,
      life: 0,
      ttl: final ? 0.75 : 0.45,
      final,
      kind: 'catch',
      sparks,
    });
    this.flash = Math.max(this.flash, final ? 0.6 : 0.2);
  }

  /** Stone chips and a brief flash when a Hard-mode dash breaks a wall. */
  wallBreakEffect(col, row) {
    const count = 20;
    const sparks = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * TAU + Math.random() * 0.4;
      const speed = 0.9 + Math.random() * 2.2;
      return {
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        size: 1 + Math.floor(Math.random() * 3),
      };
    });

    this.effects.push({
      x: col + 0.5,
      y: row + 0.5,
      life: 0,
      ttl: 0.62,
      kind: 'stone',
      sparks,
    });
    this.flash = Math.max(this.flash, 0.2);
  }

  /** Red edge flare and a brief screen shudder cue for a lost life. */
  lifeLost() {
    this.damage = Math.max(this.damage, 0.55);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width || window.innerWidth));
    this.height = Math.max(1, Math.round(rect.height || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    this.buildBackdrop();
    this.computeCamera();
    this.buildFloorLayer();
    this.buildWallLayer();
  }

  /** Full view fills the space above the compact controls; windowed keeps every tile. */
  computeCamera() {
    const stage = this.screen === 'stage';
    const full = stage && this.mapLayout === 'full';
    const insets = full
      ? { top: 0, right: 0, bottom: this.width < 540 ? 42 : 52, left: 0 }
      : stage
        ? {
            top: Math.min(120, Math.round(this.height * 0.16)),
            right: 20,
            bottom: Math.min(84, Math.round(this.height * 0.12)),
            left: 20,
          }
        : { top: 0, right: 0, bottom: 0, left: 0 };

    this.camera.fit({
      viewportWidth: this.width,
      viewportHeight: this.height,
      columns: this.maze.columns,
      rows: this.maze.rows,
      maxCell: stage ? (full ? 240 : 40) : 44,
      insets,
      cover: false,
      fractional: full,
    });
  }

  buildBackdrop() {
    const gradient = this.ctx.createRadialGradient(
      this.width * 0.48,
      this.height * 0.3,
      0,
      this.width * 0.5,
      this.height * 0.52,
      Math.max(this.width, this.height) * 0.82,
    );
    gradient.addColorStop(0, '#0b1519');
    gradient.addColorStop(0.5, '#060b0e');
    gradient.addColorStop(1, '#020304');
    this.backdrop = gradient;
  }

  buildFloorLayer() {
    const { columns, rows, tiles } = this.maze;
    const cell = this.camera.cell;
    this.floorLayer = null;
    if (!cell) return;

    const canvas = document.createElement('canvas');
    canvas.width = columns * cell;
    canvas.height = rows * cell;
    const ctx = canvas.getContext('2d');
    const stones = ['#2a383c', '#334347', '#3b4d50', '#46585b', '#202d30'];
    const divisions = cell >= 30 ? 3 : 2;
    const step = cell / divisions;

    tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (tile === TILE.WALL) return;
        const x = c * cell;
        const y = r * cell;
        ctx.fillStyle = '#111b1e';
        ctx.fillRect(x, y, cell, cell);

        for (let sy = 0; sy < divisions; sy += 1) {
          for (let sx = 0; sx < divisions; sx += 1) {
            const pick = noise(c * 17 + sx, r * 19 + sy, 5);
            const sx0 = x + Math.floor(sx * step) + 1;
            const sy0 = y + Math.floor(sy * step) + 1;
            const sw = Math.max(1, Math.ceil(step) - 2);
            const sh = Math.max(1, Math.ceil(step) - 2);
            ctx.fillStyle = stones[Math.floor(pick * stones.length)];
            ctx.fillRect(sx0, sy0, sw, sh);
            ctx.fillStyle = 'rgba(221, 234, 226, 0.1)';
            ctx.fillRect(sx0, sy0, sw, 1);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(sx0, sy0 + sh - 1, sw, 1);
          }
        }

        if (noise(c, r, 11) > 0.88) {
          ctx.fillStyle = 'rgba(109, 132, 90, 0.18)';
          ctx.fillRect(
            x + Math.floor(cell * 0.2),
            y + Math.floor(cell * 0.72),
            Math.max(2, Math.floor(cell * 0.24)),
            1,
          );
        }
      });
    });

    this.floorLayer = canvas;
  }

  buildWallLayer() {
    const { columns, rows, tiles } = this.maze;
    const cell = this.camera.cell;
    this.wallLayer = null;
    if (!cell) return;

    const pad = Math.ceil(cell * 0.8);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(columns * cell + pad * 2);
    canvas.height = Math.ceil(rows * cell + pad * 2);
    const ctx = canvas.getContext('2d');
    ctx.translate(pad, pad);
    ctx.imageSmoothingEnabled = false;

    const isWall = (c, r) =>
      c >= 0 && r >= 0 && c < columns && r < rows && tiles[r][c] === TILE.WALL;

    const brickW = Math.max(6, Math.floor(cell * 0.55));
    const brickH = Math.max(5, Math.floor(cell * 0.3));

    tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (tile !== TILE.WALL) return;

        const x = c * cell;
        const y = r * cell;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cell, cell);
        ctx.clip();

        ctx.fillStyle = '#080d10';
        ctx.fillRect(x, y, cell, cell);

        for (let by = 0; by < cell; by += brickH) {
          const offset = (Math.floor(by / brickH) % 2) * Math.floor(brickW / 2);
          for (let bx = -brickW; bx < cell + brickW; bx += brickW) {
            const bx2 = x + bx + offset;
            const by2 = y + by;
            const pick = noise(c * 13 + Math.floor(bx / brickW), r * 17 + Math.floor(by / brickH), 7);
            const base = pick > 0.68 ? '#2b373d' : pick > 0.34 ? '#202b30' : '#192328';
            const width = Math.max(3, brickW - 2);
            const height = Math.max(3, brickH - 2);

            ctx.fillStyle = base;
            ctx.fillRect(bx2 + 1, by2 + 1, width, height);
            ctx.fillStyle = 'rgba(140, 168, 175, 0.13)';
            ctx.fillRect(bx2 + 1, by2 + 1, width, 1);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.fillRect(bx2 + 1, by2 + height, width, 1);

            if (pick > 0.9) {
              ctx.fillStyle = 'rgba(5, 8, 9, 0.65)';
              ctx.fillRect(bx2 + Math.floor(width * 0.6), by2 + 2, 1, Math.max(2, height - 3));
            } else if (pick < 0.1) {
              ctx.fillStyle = 'rgba(91, 113, 77, 0.28)';
              ctx.fillRect(bx2 + 2, by2 + Math.max(2, height - 3), Math.max(2, width - 5), 2);
            }
          }
        }

        if (!isWall(c, r - 1)) {
          ctx.fillStyle = 'rgba(190, 211, 207, 0.46)';
          ctx.fillRect(x, y, cell, Math.max(2, Math.floor(cell * 0.07)));
          ctx.fillStyle = 'rgba(190, 211, 207, 0.16)';
          ctx.fillRect(x, y + 2, cell, Math.max(1, Math.floor(cell * 0.06)));
        }
        if (!isWall(c, r + 1)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
          ctx.fillRect(
            x,
            y + cell - Math.max(2, Math.floor(cell * 0.1)),
            cell,
            Math.max(2, Math.floor(cell * 0.1)),
          );
        }
        if (!isWall(c - 1, r)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(x, y, Math.max(1, Math.floor(cell * 0.05)), cell);
        }
        if (!isWall(c + 1, r)) {
          ctx.fillStyle = 'rgba(170, 192, 193, 0.2)';
          ctx.fillRect(x + cell - Math.max(1, Math.floor(cell * 0.04)), y, 1, cell);
        }

        if (
          !isWall(c - 1, r) ||
          !isWall(c + 1, r) ||
          !isWall(c, r - 1) ||
          !isWall(c, r + 1)
        ) {
          ctx.strokeStyle = 'rgba(181, 202, 199, 0.24)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }

        ctx.restore();
      });
    });

    this.wallLayer = { canvas, pad };
  }

  update(dt) {
    this.updateEffects(dt);
    if (!this.animate) return;

    this.time += dt;
    this.updateParticles(dt);
    this.updateArcs(dt);
  }

  updateEffects(dt) {
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.damage = Math.max(0, this.damage - dt * 1.9);

    for (const effect of this.effects) {
      effect.life += dt;
      for (const spark of effect.sparks) {
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vx *= 0.92;
        spark.vy = spark.vy * 0.92 + 0.7 * dt;
      }
    }
    this.effects = this.effects.filter((effect) => effect.life < effect.ttl);
  }

  draw() {
    const { ctx } = this;
    if (!this.backdrop) return;

    ctx.fillStyle = this.backdrop;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawMoonGlow();

    const stage = this.screen === 'stage';

    if (this.floorLayer) {
      ctx.save();
      ctx.globalAlpha = stage ? 1 : 0.36;
      ctx.drawImage(this.floorLayer, this.camera.x, this.camera.y);
      ctx.restore();
    }

    if (this.wallLayer) {
      ctx.save();
      ctx.globalAlpha = stage ? 1 : 0.48;
      ctx.drawImage(
        this.wallLayer.canvas,
        this.camera.x - this.wallLayer.pad,
        this.camera.y - this.wallLayer.pad,
      );
      ctx.restore();
    }

    this.drawBolts();
    if (stage) {
      this.drawLampLights();
      this.drawLampFixtures();
    }
    if (stage && this.animate) this.drawSweep();
    if (this.animate) {
      this.drawParticles();
      this.drawArcs();
    }

    if (stage && this.story?.elizabeth) this.drawElizabethSprite();
    if (stage && this.creature) this.drawCreatureSprite();
    if (stage && this.player) this.drawPlayer();
    if (stage) {
      this.drawEffects();
      this.drawScreenEffects();
    }
  }

  drawMoonGlow() {
    const { ctx } = this;
    const radius = Math.max(this.width, this.height) * 0.42;
    const gradient = ctx.createRadialGradient(
      this.width * 0.78,
      this.height * 0.08,
      0,
      this.width * 0.78,
      this.height * 0.08,
      radius,
    );
    gradient.addColorStop(0, 'rgba(190, 208, 207, 0.07)');
    gradient.addColorStop(1, 'rgba(190, 208, 207, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawPlayer() {
    const point = this.camera.toScreen(this.player.x, this.player.y);
    const direction = this.player.direction?.name ?? this.playerFacing;
    this.playerFacing = direction;
    const frame = this.player.moving ? Math.floor(this.time * 9) % 2 : 0;

    drawVictor(this.ctx, {
      x: point.x,
      y: point.y,
      cell: this.camera.cell,
      direction,
      frame,
    });
  }

  drawCreatureSprite() {
    const creature = this.creature;
    const point = this.camera.toScreen(creature.x, creature.y);
    const direction = creature.direction?.name ?? this.creatureFacing;
    this.creatureFacing = direction;
    const frame = creature.moving ? Math.floor(this.time * 9) % 2 : 0;
    const { ctx } = this;
    const cell = this.camera.cell;

    if (creature.dashing) {
      const drift = {
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
      }[direction] ?? { x: 0, y: 1 };

      ctx.save();
      for (const [back, alpha] of [
        [cell * 0.28, 0.22],
        [cell * 0.54, 0.11],
      ]) {
        ctx.globalAlpha = alpha;
        drawCreature(ctx, {
          x: point.x - drift.x * back,
          y: point.y - drift.y * back,
          cell,
          direction,
          frame,
        });
      }
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = 'rgba(229, 153, 99, 0.6)';
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.beginPath();
      ctx.arc(point.x, point.y, cell * 0.6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (creature.invulnerableFor > 0) {
      ctx.globalAlpha = Math.floor(creature.invulnerableFor * 6) % 2 === 0 ? 0.28 : 1;
    }
    drawCreature(ctx, {
      x: point.x,
      y: point.y,
      cell: this.camera.cell,
      direction,
      frame,
    });
    ctx.restore();
  }

  drawElizabethSprite() {
    const { ctx, story } = this;
    const elizabeth = story.elizabeth;
    const point = this.camera.toScreen(elizabeth.x, elizabeth.y);
    const cell = this.camera.cell;
    const direction = elizabeth.direction?.name ?? this.elizabethFacing;
    this.elizabethFacing = direction;
    const frame = elizabeth.moving ? Math.floor(this.time * 6) % 2 : 0;
    const pulse = this.animate ? 0.5 + 0.5 * Math.sin(this.time * 2.6) : 0.7;

    ctx.save();
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, cell * 1.35);
    glow.addColorStop(0, `rgba(255, 193, 165, ${0.1 + pulse * 0.05})`);
    glow.addColorStop(1, 'rgba(255, 193, 165, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(point.x - cell * 1.35, point.y - cell * 1.35, cell * 2.7, cell * 2.7);

    ctx.beginPath();
    ctx.arc(point.x, point.y, cell * (0.52 + pulse * 0.12), 0, TAU);
    ctx.strokeStyle = `rgba(255, 207, 172, ${0.2 + pulse * 0.24})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    drawElizabeth(ctx, {
      x: point.x,
      y: point.y,
      cell,
      direction,
      frame,
    });

    if (cell >= 20) {
      ctx.font = `${Math.max(6, Math.round(cell * 0.17))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 222, 193, 0.94)';
      ctx.fillText('ELIZABETH', point.x, point.y - cell * 0.88);
    }
    ctx.restore();
  }

  drawLampLights() {
    const { ctx } = this;
    const cell = this.camera.cell;
    if (!cell) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of this.lampCells) {
      const point = this.camera.toScreen(lamp.col + 0.5, lamp.row + 0.5);
      const flicker = 0.86 + 0.14 * Math.sin(this.time * 4.8 + lamp.phase);
      const radius = cell * 2.8;
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(255, 186, 92, ${0.2 * flicker})`);
      gradient.addColorStop(0.43, `rgba(244, 158, 68, ${0.07 * flicker})`);
      gradient.addColorStop(1, 'rgba(230, 140, 52, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawLampFixtures() {
    const { ctx } = this;
    const cell = this.camera.cell;
    if (!cell) return;

    for (const lamp of this.lampCells) {
      const point = this.camera.toScreen(lamp.col + 0.5, lamp.row + 0.5);
      const flicker = 0.78 + 0.22 * Math.sin(this.time * 5.1 + lamp.phase);
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      const w = Math.max(2, Math.round(cell * 0.08));

      ctx.fillStyle = '#07090a';
      ctx.fillRect(x - w / 2, y - cell * 0.2, w, cell * 0.34);
      ctx.fillStyle = '#2b2318';
      ctx.fillRect(x - cell * 0.13, y - cell * 0.28, cell * 0.26, cell * 0.23);
      ctx.fillStyle = `rgba(255, 198, 104, ${flicker})`;
      ctx.fillRect(x - cell * 0.075, y - cell * 0.23, cell * 0.15, cell * 0.14);
      ctx.strokeStyle = 'rgba(15, 14, 11, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(x - cell * 0.13),
        Math.round(y - cell * 0.28),
        Math.round(cell * 0.26),
        Math.round(cell * 0.23),
      );
    }
  }

  drawBolts() {
    const { cell, x, y } = this.camera;
    if (!cell) return;

    const { ctx, maze } = this;
    const stage = this.screen === 'stage';
    const dot = Math.max(1, Math.round(cell * 0.075));
    const bolts = new Path2D();
    const powerCells = [];

    maze.tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        const cx = x + c * cell + cell / 2;
        const cy = y + r * cell + cell / 2;
        if (tile === TILE.PELLET) {
          bolts.moveTo(cx + dot, cy);
          bolts.arc(cx, cy, dot, 0, TAU);
        } else if (tile === TILE.POWER) {
          powerCells.push({ cx, cy });
        }
      });
    });

    ctx.fillStyle = stage ? 'rgba(216, 200, 168, 0.58)' : 'rgba(216, 200, 168, 0.18)';
    ctx.fill(bolts);

    for (const { cx, cy } of powerCells) {
      const radius = Math.max(1.5, cell * 0.2 * (1 + 0.16 * Math.sin(this.time * 2.1)));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fillStyle = stage ? 'rgba(244, 190, 96, 0.9)' : 'rgba(244, 190, 96, 0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, cell * 0.36), 0, TAU);
      ctx.strokeStyle = stage ? 'rgba(244, 190, 96, 0.22)' : 'rgba(244, 190, 96, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  drawParticles() {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(190, 205, 207, ${this.screen === 'stage' ? 0.12 : 0.07})`;

    for (const particle of this.particles) {
      const px = particle.x * this.width + Math.sin(this.time * 0.55 + particle.phase) * particle.sway;
      const py = particle.y * this.height;
      ctx.beginPath();
      ctx.arc(px, py, particle.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.y -= particle.speed * dt;
      if (particle.y < -0.05) {
        particle.y = 1.05;
        particle.x = Math.random();
      }
    }
  }

  updateArcs(dt) {
    this.arcClock -= dt;
    if (this.arcClock <= 0) {
      this.spawnArc();
      this.arcClock = 2.4 + Math.random() * 3.2;
    }
    for (const arc of this.arcs) arc.life -= dt;
    this.arcs = this.arcs.filter((arc) => arc.life > 0);
  }

  spawnArc() {
    const { cell, x, y } = this.camera;
    if (this.arcs.length >= 2 || !this.wallCells.length || !cell) return;

    const origin = this.wallCells[Math.floor(Math.random() * this.wallCells.length)];
    const start = {
      x: x + origin.c * cell + cell / 2,
      y: y + origin.r * cell + cell / 2,
    };
    const segments = 3 + Math.floor(Math.random() * 3);
    const spanX = (Math.random() - 0.5) * cell * 8;
    const spanY = (Math.random() - 0.5) * cell * 5;
    const points = [start];

    for (let index = 1; index <= segments; index += 1) {
      const t = index / segments;
      points.push({
        x: start.x + spanX * t + (Math.random() - 0.5) * cell * 0.7,
        y: start.y + spanY * t + (Math.random() - 0.5) * cell * 0.7,
      });
    }
    this.arcs.push({ points, life: 0.18, ttl: 0.18 });
  }

  drawArcs() {
    if (!this.arcs.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (const arc of this.arcs) {
      const alpha = (arc.life / arc.ttl) * (this.screen === 'stage' ? 0.4 : 0.2);
      ctx.beginPath();
      arc.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = `rgba(184, 216, 226, ${alpha * 0.2})`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(226, 240, 244, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSweep() {
    const { ctx, maze } = this;
    const { cell, x, y } = this.camera;
    if (!cell) return;

    const progress = ((this.time * 0.05) % 1.2) - 0.1;
    const sweepY = y + progress * maze.rows * cell;
    const gradient = ctx.createLinearGradient(0, sweepY - cell * 1.6, 0, sweepY + cell * 1.6);
    gradient.addColorStop(0, 'rgba(170, 200, 208, 0)');
    gradient.addColorStop(0.5, 'rgba(170, 200, 208, 0.026)');
    gradient.addColorStop(1, 'rgba(170, 200, 208, 0)');

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, maze.columns * cell, maze.rows * cell);
    ctx.clip();
    ctx.fillStyle = gradient;
    ctx.fillRect(x, sweepY - cell * 1.6, maze.columns * cell, cell * 3.2);
    ctx.restore();
  }

  drawEffects() {
    if (!this.effects.length) return;
    const { ctx } = this;
    const cell = this.camera.cell;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const effect of this.effects) {
      const progress = effect.life / effect.ttl;
      const point = this.camera.toScreen(effect.x, effect.y);
      const alpha = 1 - progress;
      const stone = effect.kind === 'stone';
      const radius = cell * (0.22 + progress * (effect.final ? 1.7 : 1.1));

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, TAU);
      ctx.strokeStyle = stone
        ? `rgba(205, 220, 216, ${alpha * 0.72})`
        : effect.final
          ? `rgba(255, 225, 154, ${alpha * 0.9})`
          : `rgba(244, 190, 96, ${alpha * 0.7})`;
      ctx.lineWidth = Math.max(1, cell * 0.055 * alpha);
      ctx.stroke();

      if (effect.final) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 0.62, 0, TAU);
        ctx.strokeStyle = `rgba(232, 112, 92, ${alpha * 0.55})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const spark of effect.sparks) {
        ctx.fillStyle = stone
          ? `rgba(191, 207, 203, ${alpha * 0.9})`
          : effect.final
            ? `rgba(255, 220, 150, ${alpha})`
            : `rgba(240, 184, 92, ${alpha * 0.9})`;
        ctx.fillRect(
          Math.round(point.x + spark.x * cell),
          Math.round(point.y + spark.y * cell),
          spark.size,
          spark.size,
        );
      }
    }

    ctx.restore();
  }

  drawScreenEffects() {
    const { ctx } = this;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 226, 170, ${this.flash * 0.16})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.damage > 0) {
      const radius = Math.max(this.width, this.height) * 0.78;
      const gradient = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        radius * 0.32,
        this.width / 2,
        this.height / 2,
        radius,
      );
      gradient.addColorStop(0, 'rgba(120, 12, 22, 0)');
      gradient.addColorStop(1, `rgba(134, 18, 27, ${this.damage * 0.42})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
  }
}
