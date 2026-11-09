export const TILE_W = 64;
export const TILE_H = 32;

export const DIR_VEC = [
  [1, 0],   // 0 east
  [0, 1],   // 1 south
  [-1, 0],  // 2 west
  [0, -1],  // 3 north
];
export const DIR_NAME = ['east', 'south', 'west', 'north'];
export const DIR_ARROW = ['→', '↓', '←', '↑'];
export const opp = d => (d + 2) % 4;
export const EDGE_DIR = { e: 0, s: 1, w: 2, n: 3 };

export function tileToScreen(tx, ty) {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

export function screenToTile(x, y) {
  const u = x / (TILE_W / 2);
  const v = y / (TILE_H / 2);
  return { x: Math.round((u + v) / 2), y: Math.round((v - u) / 2) };
}

export function tileKey(x, y) {
  return `${x},${y}`;
}

export function objectCenterTile(o) {
  return { x: o.x + (o.w - 1) / 2, y: o.y + (o.h - 1) / 2 };
}

export function objectScreenPos(o) {
  const c = objectCenterTile(o);
  const p = tileToScreen(c.x, c.y);
  return { x: p.x, y: p.y + (TILE_H / 2) };
}

export function edgeTiles(o, dir) {
  const out = [];
  if (dir === 0) {
    for (let y = o.y; y < o.y + o.h; y++) out.push([o.x + o.w, y]);
  } else if (dir === 2) {
    for (let y = o.y; y < o.y + o.h; y++) out.push([o.x - 1, y]);
  } else if (dir === 1) {
    for (let x = o.x; x < o.x + o.w; x++) out.push([x, o.y + o.h]);
  } else {
    for (let x = o.x; x < o.x + o.w; x++) out.push([x, o.y - 1]);
  }
  return out;
}

// Is a footprint tile on the given edge of the object?
export function tileOnEdge(o, x, y, dir) {
  if (x < o.x || x >= o.x + o.w || y < o.y || y >= o.y + o.h) return false;
  if (dir === 0) return x === o.x + o.w - 1;
  if (dir === 2) return x === o.x;
  if (dir === 1) return y === o.y + o.h - 1;
  return y === o.y;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function isoDepth(tx, ty) {
  return (tx + ty) * 100;
}
