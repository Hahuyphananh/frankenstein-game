/**
 * Pixel-art character sprites.
 *
 * Every character is drawn on a 32x32 design grid, cached as a tiny canvas,
 * then scaled with image smoothing disabled. Silhouettes and accent colours
 * are deliberately distinct so the cast stays readable at small maze sizes.
 *
 * Directions: down, up, left, right. Frames: 0 (contact) and 1 (passing).
 * Right-facing sprites reuse the left-facing cache mirrored at draw time.
 */

const SIZE = 32;
const OUTLINE = '#080a0d';
const EYE = '#17130f';
const TAU = Math.PI * 2;

const PALETTES = Object.freeze({
  victor: Object.freeze({
    skin: '#d8b58e',
    skinShadow: '#b8916d',
    hair: '#231c17',
    hairLight: '#3a2c22',
    coat: '#1d2736',
    coatLight: '#31445c',
    coatDark: '#141c27',
    trousers: '#171d26',
    boots: '#0b0e12',
    cravat: '#e8e2d2',
    waistcoat: '#632b36',
    belt: '#0d1116',
    gold: '#c9a85f',
    glasses: '#d8c690',
    glassShade: '#3a3a32',
    mouth: '#6d4b3d',
  }),
  creature: Object.freeze({
    skin: '#7f9d69',
    skinShadow: '#5f7b4d',
    hair: '#10140f',
    hairDark: '#080b08',
    coat: '#252c25',
    coatLight: '#394135',
    coatDark: '#171c18',
    trousers: '#1b201b',
    boots: '#0b0d0b',
    cravat: '#b8494e',
    waistcoat: '#2c332b',
    belt: '#0d100d',
    stitch: '#bd4c50',
    bolt: '#b8b6a6',
    eye: '#f0b84a',
    mouth: '#3b2924',
    gold: '#b8494e',
    glasses: '#b8b6a6',
    glassShade: '#1a1a17',
    skinLight: '#93b07b',
  }),
  william: Object.freeze({
    skin: '#e0c3a3',
    skinShadow: '#bd9d7e',
    hair: '#6b4a2f',
    hairLight: '#8b6742',
    coat: '#465a70',
    coatLight: '#607890',
    coatDark: '#2d3b4b',
    trousers: '#30363e',
    boots: '#14171b',
    scarf: '#b23a3f',
    waistcoat: '#7f8f9f',
    belt: '#20252b',
    cap: '#3d4247',
    capShade: '#292d31',
    lantern: '#f4c35a',
    lanternDark: '#6b5128',
    iron: '#1b1d1e',
    mouth: '#755142',
  }),
  justine: Object.freeze({
    skin: '#d9b792',
    skinShadow: '#b5906d',
    hair: '#433024',
    hairLight: '#5d4432',
    dress: '#33405a',
    dressLight: '#455678',
    dressDark: '#232d42',
    collar: '#e2dbc9',
    apron: '#ded7c5',
    apronShade: '#bdb5a2',
    cap: '#e7e0cf',
    capShade: '#c6beab',
    mouth: '#7a5546',
    gold: '#c9a85f',
  }),
  henry: Object.freeze({
    skin: '#d8b58e',
    skinShadow: '#b8916d',
    hair: '#5a3a24',
    hairLight: '#7b5738',
    coat: '#6a5740',
    coatLight: '#8b765b',
    coatDark: '#4b3c2b',
    trousers: '#2b3030',
    boots: '#111416',
    cravat: '#e8e2d2',
    waistcoat: '#4d6154',
    belt: '#1b1a16',
    gold: '#c9a85f',
    mouth: '#704d3e',
  }),
  elizabeth: Object.freeze({
    skin: '#e0c3a3',
    skinShadow: '#bd9d7e',
    hair: '#6e3d26',
    hairLight: '#925634',
    dress: '#52293b',
    dressLight: '#703b50',
    dressDark: '#371c29',
    collar: '#ded3bd',
    shawl: '#7b5c46',
    shawlDark: '#5b4232',
    mouth: '#7a5546',
    gold: '#d1af63',
  }),
});

const cache = new Map();

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function drawShadow(ctx, width = 16) {
  const left = 16 - Math.floor(width / 2);
  px(ctx, left, 29, width, 2, 'rgba(0, 0, 0, 0.42)');
  px(ctx, left + 2, 31, Math.max(2, width - 4), 1, 'rgba(0, 0, 0, 0.22)');
}

function drawHumanLegs(ctx, p, direction, frame) {
  const lift = frame ? 1 : 0;

  if (direction === 'left') {
    px(ctx, 12, 24 + lift, 4, 6 - lift, p.trousers);
    px(ctx, 11, 29 + lift, 5, 2, p.boots);
    px(ctx, 17, 24, 4, 5 + lift, p.trousers);
    px(ctx, 17, 29, 5, 2 + lift, p.boots);
    return;
  }

  px(ctx, 12, 24 + lift, 4, 6 - lift, p.trousers);
  px(ctx, 11, 29 + lift, 5, 2, p.boots);
  px(ctx, 17, 24, 4, 6 - lift, p.trousers);
  px(ctx, 17, 29, 5, 2 + lift, p.boots);
}

function drawHumanTorso(ctx, p, direction, frame, kind) {
  const swing = frame ? 1 : -1;

  px(ctx, 9, 10, 14, 15, OUTLINE);
  px(ctx, 10, 11, 12, 13, p.coat);
  px(ctx, 10, 23, 5, 3, p.coatDark);
  px(ctx, 17, 23, 5, 3, p.coatDark);
  px(ctx, 11, 12, 2, 6, p.coatLight);
  px(ctx, 19, 12, 2, 6, p.coatLight);

  if (direction !== 'up') {
    px(ctx, 14, 11, 4, 2, p.cravat);
    px(ctx, 15, 13, 2, 2, p.cravat);
    px(ctx, 14, 15, 4, 6, p.waistcoat);
    px(ctx, 15, 16, 1, 1, p.gold);
    px(ctx, 15, 19, 1, 1, p.gold);
  } else {
    px(ctx, 14, 11, 4, 1, p.cravat);
    px(ctx, 15, 12, 2, 10, p.coatDark);
    px(ctx, 14, 22, 4, 1, p.belt);
  }

  px(ctx, 12, 21, 8, 1, p.belt);

  if (direction === 'left') {
    px(ctx, 7, 13, 3, 8 - swing, p.coatDark);
    px(ctx, 6, 20 - swing, 3, 2, p.skin);
  } else {
    px(ctx, 7, 13, 3, 8 - swing, p.coatDark);
    px(ctx, 22, 13, 3, 8 + swing, p.coatDark);
    px(ctx, 6, 20 - swing, 3, 2, p.skin);
    px(ctx, 23, 20 + swing, 3, 2, p.skin);
  }

  if (kind === 'victor' && direction !== 'up') {
    px(ctx, 22, 19, 3, 3, '#8fd16b');
    px(ctx, 23, 18, 1, 1, '#c9f3a8');
  }
}

function drawMaleHead(ctx, p, direction, kind) {
  px(ctx, 10, 1, 12, 11, OUTLINE);

  if (direction === 'up') {
    px(ctx, 11, 2, 10, 9, p.hair);
    px(ctx, 10, 2, 2, 7, p.hair);
    px(ctx, 20, 2, 2, 7, p.hair);
    px(ctx, 13, 10, 6, 2, p.coatDark);
    return;
  }

  px(ctx, 11, 2, 10, 8, p.skin);
  px(ctx, 10, 1, 12, 4, p.hair);
  px(ctx, 10, 4, 2, 5, p.hair);
  px(ctx, 20, 4, 2, 5, p.hair);

  if (direction === 'left') {
    px(ctx, 11, 4, 3, 1, p.hairLight);
    px(ctx, 12, 6, 1, 2, EYE);
    px(ctx, 10, 7, 2, 1, p.skinShadow);
    px(ctx, 13, 9, 3, 1, p.mouth);
  } else {
    px(ctx, 13, 6, 1, 2, EYE);
    px(ctx, 18, 6, 1, 2, EYE);
    px(ctx, 15, 8, 2, 1, p.skinShadow);
    px(ctx, 14, 9, 4, 1, p.mouth);
  }

  px(ctx, 13, 11, 6, 1, p.cravat);

  if (kind === 'victor') {
    if (direction === 'left') {
      px(ctx, 10, 5, 5, 1, p.glasses);
      px(ctx, 14, 5, 1, 2, p.glasses);
      px(ctx, 11, 6, 1, 1, p.glassShade);
    } else {
      px(ctx, 12, 5, 4, 1, p.glasses);
      px(ctx, 17, 5, 4, 1, p.glasses);
      px(ctx, 16, 5, 1, 1, p.glasses);
      px(ctx, 13, 6, 1, 1, p.glassShade);
      px(ctx, 19, 6, 1, 1, p.glassShade);
    }
    px(ctx, 9, 1, 2, 2, p.hair);
    px(ctx, 21, 1, 1, 3, p.hair);
  } else if (kind === 'henry') {
    px(ctx, 11, 3, 5, 1, p.hairLight);
    px(ctx, 20, 3, 1, 3, p.hair);
    px(ctx, 21, 19, 2, 2, p.gold);
  }
}

function drawFemaleHead(ctx, p, direction, kind) {
  px(ctx, 9, 1, 14, 12, OUTLINE);

  if (direction === 'up') {
    px(ctx, 10, 2, 12, 10, p.hair);
    px(ctx, 9, 4, 2, 8, p.hair);
    px(ctx, 21, 4, 2, 8, p.hair);
    px(ctx, 14, 0, 4, 3, p.hair);
    if (kind === 'justine') {
      px(ctx, 11, 2, 10, 2, p.cap);
      px(ctx, 12, 4, 8, 1, p.capShade);
    }
    return;
  }

  px(ctx, 11, 2, 10, 9, p.skin);
  px(ctx, 9, 1, 14, 4, p.hair);
  px(ctx, 9, 4, 2, 7, p.hair);
  px(ctx, 21, 4, 2, 8, p.hair);

  if (direction === 'left') {
    px(ctx, 12, 6, 1, 2, EYE);
    px(ctx, 10, 7, 2, 1, p.skinShadow);
    px(ctx, 13, 9, 3, 1, p.mouth);
    px(ctx, 9, 3, 6, 2, p.hair);
  } else {
    px(ctx, 13, 6, 1, 2, EYE);
    px(ctx, 18, 6, 1, 2, EYE);
    px(ctx, 15, 8, 2, 1, p.skinShadow);
    px(ctx, 14, 9, 4, 1, p.mouth);
    px(ctx, 11, 4, 4, 1, p.hairLight);
  }

  px(ctx, 13, 11, 6, 1, p.collar);

  if (kind === 'justine') {
    px(ctx, 13, 0, 6, 3, p.cap);
    px(ctx, 12, 2, 8, 1, p.capShade);
  } else {
    px(ctx, 8, 4, 2, 9, p.hairLight);
    px(ctx, 22, 4, 2, 10, p.hairLight);
    if (direction !== 'up') {
      px(ctx, 15, 13, 2, 1, p.gold);
      px(ctx, 15, 14, 2, 1, p.gold);
    }
  }
}

function drawMale(ctx, kind, direction, frame) {
  const p = PALETTES[kind];
  drawShadow(ctx, 16);
  drawHumanLegs(ctx, p, direction, frame);
  drawHumanTorso(ctx, p, direction, frame, kind);
  drawMaleHead(ctx, p, direction, kind);
}

function drawGown(ctx, kind, direction, frame) {
  const p = PALETTES[kind];
  const swing = frame ? 1 : 0;

  drawShadow(ctx, 18);

  for (let row = 0; row < 11; row += 1) {
    const width = 14 + row;
    const left = 16 - Math.floor(width / 2) + (row > 5 && direction === 'left' ? -1 : 0);
    px(ctx, left, 19 + row, width, 1, row === 0 ? p.dressLight : p.dress);
  }
  px(ctx, 8, 29, 16, 1, p.dressDark);
  px(ctx, 9, 30, 14, 1, p.dressDark);

  px(ctx, 10, 10, 12, 9, OUTLINE);
  px(ctx, 11, 11, 10, 7, p.dress);
  px(ctx, 13, 10, 6, 2, p.collar);

  if (direction === 'left') {
    px(ctx, 8, 12, 3, 7 + swing, p.dress);
    px(ctx, 8, 19 + swing, 3, 2, p.skin);
  } else {
    px(ctx, 8, 12, 3, 7 - swing, p.dress);
    px(ctx, 21, 12, 3, 7 + swing, p.dress);
    px(ctx, 8, 19 - swing, 3, 2, p.skin);
    px(ctx, 21, 19 + swing, 3, 2, p.skin);
  }

  if (kind === 'justine') {
    if (direction !== 'up') {
      px(ctx, 13, 13, 6, 2, p.apron);
      px(ctx, 14, 15, 4, 11, p.apron);
      px(ctx, 13, 26, 6, 2, p.apronShade);
    } else {
      px(ctx, 14, 18, 4, 2, p.apron);
    }
  } else {
    px(ctx, 9, 11, 3, 6, p.shawl);
    px(ctx, 20, 11, 3, 6, p.shawl);
    px(ctx, 10, 16, 12, 1, p.shawlDark);
    if (direction !== 'up') {
      px(ctx, 15, 14, 2, 1, p.gold);
      px(ctx, 15, 15, 2, 1, p.gold);
    }
  }

  drawFemaleHead(ctx, p, direction, kind);
}

function drawChild(ctx, direction, frame) {
  const p = PALETTES.william;
  const lift = frame ? 1 : 0;

  drawShadow(ctx, 12);

  px(ctx, 13, 23 + lift, 3, 5 - lift, p.trousers);
  px(ctx, 12, 28 + lift, 4, 2, p.boots);
  px(ctx, 17, 23, 3, 5 - lift, p.trousers);
  px(ctx, 17, 28, 4, 2 + lift, p.boots);

  px(ctx, 11, 14, 10, 10, OUTLINE);
  px(ctx, 12, 15, 8, 8, p.coat);
  px(ctx, 12, 22, 8, 2, p.coatDark);
  px(ctx, 9, 15, 2, 7, p.coatDark);
  px(ctx, 21, 15, 2, 7, p.coatDark);
  px(ctx, 9, 21, 2, 2, p.skin);
  px(ctx, 21, 21, 2, 2, p.skin);

  px(ctx, 12, 13, 8, 2, p.scarf);
  px(ctx, 19, 15, 2, 3, p.scarf);
  px(ctx, 14, 16, 1, 1, p.waistcoat);

  px(ctx, 11, 4, 10, 10, OUTLINE);

  if (direction === 'up') {
    px(ctx, 12, 5, 8, 8, p.hair);
    px(ctx, 10, 3, 12, 3, p.cap);
    px(ctx, 9, 5, 14, 1, p.capShade);
    px(ctx, 12, 12, 8, 1, p.scarf);
    return;
  }

  px(ctx, 12, 5, 8, 7, p.skin);
  px(ctx, 11, 4, 10, 3, p.hair);

  if (direction === 'left') {
    px(ctx, 12, 8, 1, 2, EYE);
    px(ctx, 11, 9, 1, 1, p.skinShadow);
    px(ctx, 14, 10, 3, 1, p.mouth);
  } else {
    px(ctx, 13, 8, 1, 2, EYE);
    px(ctx, 18, 8, 1, 2, EYE);
    px(ctx, 15, 9, 2, 1, p.skinShadow);
    px(ctx, 14, 10, 4, 1, p.mouth);
  }

  px(ctx, 10, 3, 12, 2, p.cap);
  px(ctx, 9, 5, 14, 1, p.capShade);

  px(ctx, 24, 17, 1, 3, p.iron);
  px(ctx, 23, 20, 4, 4, p.lanternDark);
  px(ctx, 24, 21, 2, 2, p.lantern);
  px(ctx, 22, 20, 1, 3, 'rgba(244, 195, 90, 0.28)');
  px(ctx, 27, 20, 1, 3, 'rgba(244, 195, 90, 0.2)');
}

function drawCreaturePixels(ctx, direction, frame) {
  const p = PALETTES.creature;
  const swing = frame ? 1 : -1;

  drawShadow(ctx, 22);

  px(ctx, 9, 23, 6, 8, p.trousers);
  px(ctx, 7, 30, 8, 2, p.boots);
  px(ctx, 17, 23 + (frame ? 1 : 0), 6, 8 - (frame ? 1 : 0), p.trousers);
  px(ctx, 17, 30, 8, 2, p.boots);

  px(ctx, 5, 6, 22, 19, OUTLINE);
  px(ctx, 6, 7, 20, 17, p.coat);
  px(ctx, 7, 8, 18, 4, p.coatLight);
  px(ctx, 6, 22, 5, 3, p.coatDark);
  px(ctx, 12, 23, 3, 2, p.coatDark);
  px(ctx, 21, 22, 5, 3, p.coatDark);

  px(ctx, 4, 8, 4, 7, p.coat);
  px(ctx, 24, 8, 4, 7, p.coat);
  px(ctx, 2, 10, 4, 14 - swing, p.coat);
  px(ctx, 26, 10, 4, 14 + swing, p.coat);
  px(ctx, 2, 23 - swing, 4, 4, p.skin);
  px(ctx, 26, 23 + swing, 4, 4, p.skin);
  px(ctx, 2, 25 - swing, 1, 1, p.skinShadow);
  px(ctx, 29, 25 + swing, 1, 1, p.skinShadow);

  if (direction !== 'up') {
    px(ctx, 11, 12, 10, 10, p.skin);
    px(ctx, 12, 13, 8, 7, p.skinLight);
    px(ctx, 12, 14, 3, 1, p.stitch);
    px(ctx, 15, 16, 3, 1, p.stitch);
    px(ctx, 13, 18, 4, 1, p.stitch);
    px(ctx, 18, 13, 1, 4, p.stitch);
  } else {
    px(ctx, 11, 10, 10, 12, p.coatDark);
    px(ctx, 12, 12, 8, 8, p.coat);
    px(ctx, 12, 14, 8, 1, p.stitch);
    px(ctx, 16, 16, 1, 5, p.stitch);
  }

  px(ctx, 13, 9, 6, 3, p.skin);
  px(ctx, 7, 10, 3, 2, p.bolt);
  px(ctx, 22, 10, 3, 2, p.bolt);

  px(ctx, 9, 0, 15, 13, OUTLINE);
  px(ctx, 10, 1, 13, 11, p.skin);
  px(ctx, 9, 0, 15, 4, p.hair);
  px(ctx, 9, 3, 3, 6, p.hair);
  px(ctx, 21, 3, 3, 6, p.hair);

  if (direction === 'up') {
    px(ctx, 10, 2, 13, 9, p.hair);
    px(ctx, 9, 0, 15, 5, p.hairDark);
    px(ctx, 12, 8, 8, 1, p.stitch);
    px(ctx, 13, 10, 6, 1, p.stitch);
    return;
  }

  if (direction === 'left') {
    px(ctx, 11, 4, 6, 1, p.hair);
    px(ctx, 12, 6, 2, 2, p.eye);
    px(ctx, 10, 8, 2, 1, p.skinShadow);
    px(ctx, 12, 9, 4, 1, p.stitch);
    px(ctx, 10, 7, 1, 2, p.stitch);
  } else {
    px(ctx, 11, 4, 5, 2, p.hair);
    px(ctx, 17, 4, 4, 2, p.hair);
    px(ctx, 12, 6, 2, 2, p.eye);
    px(ctx, 18, 6, 2, 2, p.eye);
    px(ctx, 15, 8, 3, 1, p.skinShadow);
    px(ctx, 12, 9, 8, 1, p.stitch);
    px(ctx, 14, 10, 4, 2, p.mouth);
    px(ctx, 20, 8, 2, 1, p.stitch);
  }
}

function buildSprite(kind, direction, frame) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (kind === 'creature') drawCreaturePixels(ctx, direction, frame);
  else if (kind === 'william') drawChild(ctx, direction, frame);
  else if (kind === 'justine' || kind === 'elizabeth') drawGown(ctx, kind, direction, frame);
  else drawMale(ctx, kind, direction, frame);

  return canvas;
}

function getSprite(kind, direction, frame) {
  const key = `${kind}:${direction}:${frame}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildSprite(kind, direction, frame);
    cache.set(key, sprite);
  }
  return sprite;
}

function drawSprite(kind, ctx, options = {}) {
  const {
    x = 0,
    y = 0,
    cell = 32,
    direction = 'down',
    frame = 0,
  } = options;

  const facing = direction === 'right' ? 'left' : direction;
  const flip = direction === 'right';
  const sprite = getSprite(kind, facing, frame % 2);
  const factor = kind === 'creature' ? 1.18 : kind === 'william' ? 0.82 : 1;
  const size = Math.max(1, Math.round(cell * factor));
  const top = Math.round(y - size / 2 + (kind === 'creature' ? -cell * 0.04 : 0));
  const centerX = Math.round(x);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(centerX, top);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -Math.round(size / 2), 0, size, size);
  ctx.restore();
}

export function drawVictor(ctx, options = {}) {
  drawSprite('victor', ctx, options);
}

export function drawCreature(ctx, options = {}) {
  drawSprite('creature', ctx, options);
}

export function drawWilliam(ctx, options = {}) {
  drawSprite('william', ctx, options);
}

export function drawJustine(ctx, options = {}) {
  drawSprite('justine', ctx, options);
}

export function drawHenry(ctx, options = {}) {
  drawSprite('henry', ctx, options);
}

export function drawElizabeth(ctx, options = {}) {
  drawSprite('elizabeth', ctx, options);
}

/** Paint a crisp idle portrait into a cast canvas in the instructions. */
export function drawCastPortrait(canvas, kind) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  drawSprite(kind, ctx, {
    x: width / 2,
    y: height * 0.52,
    cell: width * 0.78,
    direction: 'down',
    frame: 0,
  });
}
