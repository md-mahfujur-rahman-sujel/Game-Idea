import { BUILDINGS, SIM, UPGRADES, ECONOMY, RECIPES } from '../data/buildings.js';
import { ITEMS, FAMILIES } from '../data/items.js';
import { isBuildable } from '../data/levels.js';
import { tileKey, EDGE_DIR, opp, DIR_VEC, edgeTiles, tileOnEdge } from './iso.js';

export function createLevelState(level) {
  const s = {
    levelId: level.id,
    coins: level.startingCoins,
    reputation: level.startingReputation,
    startingReputation: level.startingReputation,
    creamBought: 0,
    nextObjectId: 1,
    objects: [],
    belts: {},
    orders: { active: [], queueIndex: 0, spawnTimer: 0, errand: null },
    counters: {
      fulfilled: 0,
      byType: {},
      fruitOrders: 0,
      baseOrders: 0,
      teaOrders: 0,
      tubOrders: 0,
      customerLeft: 0,
      melted: 0,
      soldMachines: 0,
      repLoss: 0,
      beltsPlaced: 0,
      creamPurchased: 0,
      itemsDiscarded: 0,
    },
    trackers: {
      elapsedTicks: 0,
      longestBlock: 0,
      completed: false,
      optionalEarned: [],
      recoveryUsed: false,
    },
    paused: false,
    levelDone: false,
    hintDismissed: false,
    notices: [],
  };

  for (const p of level.preplaced || []) {
    placeObject(s, level, p.type, p.x, p.y, p.rot || 0, { free: true, silent: true });
  }
  for (const b of level.preBelts || []) {
    s.belts[tileKey(b.x, b.y)] = { x: b.x, y: b.y, dir: b.dir, item: null, preplaced: true };
  }
  return s;
}

export function createObject(type, x, y, rot = 0) {
  const def = BUILDINGS[type];
  const o = {
    id: 0,
    type, x, y, rot: rot % 4,
    w: def.w, h: def.h,
    state: 'idle',
    blockedStreak: 0,
  };
  if (def.kind === 'source') {
    o.lanes = def.outputs.map(out => ({
      item: out.item,
      edge: out.edge,
      tile: out.tile,
      every: out.every,
      buffer: out.buffer || 2,
      manual: !!out.manual,
      buf: [],
      timer: out.every,
    }));
  }
  if (def.kind === 'machine') {
    o.inputs = def.inputs.map(soc => ({ family: soc.family, label: soc.label, buf: [] }));
    o.output = [];
    o.outCap = def.outCap || 2;
    o.progress = 0;
    o.recipe = null;
    o.recipeTicks = 0;
    o.recipeRefreezeCount = 0;
    o.speedLvl = 0;
    o.coolingLvl = 0;
    o.chilled = !!def.chilled;
    // Not saved: a short in-memory streak is enough for the live report.
    o.idleStreak = 0;
  }
  if (def.kind === 'counter') {
    o.inputs = def.inputs.map(soc => ({ family: soc.family, label: soc.label, buf: [] }));
    o.outCap = def.outCap || 2;
    o.note = '';
  }
  return o;
}

export function objectTiles(o) {
  const list = [];
  for (let y = o.y; y < o.y + o.h; y++) {
    for (let x = o.x; x < o.x + o.w; x++) list.push([x, y]);
  }
  return list;
}

export function objectAt(s, x, y) {
  for (const o of s.objects) {
    if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return o;
  }
  return null;
}

export function objectById(s, id) {
  return s.objects.find(o => o.id === id) || null;
}

export function beltAt(s, x, y) {
  return s.belts[tileKey(x, y)] || null;
}

// Whether the tile ahead can receive from this belt. This mirrors the topology
// checks in tryTransfer without needing an item in hand, so the scene can mark a
// route that points at nothing before something jams on it.
export function beltHasReceiver(s, belt) {
  const [dx, dy] = DIR_VEC[belt.dir];
  const nx = belt.x + dx;
  const ny = belt.y + dy;
  const next = beltAt(s, nx, ny);
  if (next) return next.dir !== opp(belt.dir);
  const target = objectAt(s, nx, ny);
  if (!target) return false;
  const edge = opp(belt.dir);
  if (!tileOnEdge(target, nx, ny, edge)) return false;
  const def = BUILDINGS[target.type];
  if (def.kind === 'counter') return true;
  if (def.kind === 'machine') {
    return (target.inputs || []).some((sock, i) => socketEdge(target, i) === edge);
  }
  return false;
}

export function occupiedBy(s, x, y) {
  const o = objectAt(s, x, y);
  if (o) return o;
  return beltAt(s, x, y);
}

// The tiles every object drops its output onto. Only a belt can receive an item,
// so a building parked here would jam the feeder for good.
export function outputTargets(s, ignoreId = null) {
  const out = new Map();
  for (const o of s.objects) {
    if (o.id === ignoreId) continue;
    const def = BUILDINGS[o.type];
    if (def.kind === 'machine') {
      for (const [tx, ty] of edgeTiles(o, o.rot)) out.set(tileKey(tx, ty), o);
    }
    for (const lane of o.lanes || []) {
      const dir = (EDGE_DIR[lane.edge] + (def.rotatable ? o.rot : 0)) % 4;
      const [dx, dy] = DIR_VEC[dir];
      out.set(tileKey(o.x + lane.tile[0] + dx, o.y + lane.tile[1] + dy), o);
    }
  }
  return out;
}

export function validatePlacement(s, level, type, x, y, opts = {}) {
  const def = BUILDINGS[type];
  if (!def) return { ok: false, reason: 'Unknown object' };
  if (!opts.free && s.coins < def.cost) {
    return { ok: false, reason: `Not enough coins (need ${def.cost})`, code: 'coins' };
  }
  const ports = type === 'belt' ? null : outputTargets(s, opts.ignore ? opts.ignore.id : null);
  for (const [tx, ty] of footprintTiles(type, x, y)) {
    if (!isBuildable(level, tx, ty)) {
      return { ok: false, reason: 'Outside the buildable area', code: 'bounds' };
    }
    const occ = occupiedBy(s, tx, ty);
    if (occ && occ !== opts.ignore) {
      const nm = occ.type ? BUILDINGS[occ.type].name : 'Belt';
      return { ok: false, reason: `Blocked by ${nm}`, code: 'occupied' };
    }
    const feeder = ports && ports.get(tileKey(tx, ty));
    if (feeder) {
      return {
        ok: false,
        code: 'port',
        reason: `${BUILDINGS[feeder.type].name} drops its output here. A belt must reach it.`,
      };
    }
  }
  return { ok: true };
}

export function footprintTiles(type, x, y) {
  const def = BUILDINGS[type];
  const list = [];
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) list.push([x + dx, y + dy]);
  }
  return list;
}

export function placeObject(s, level, type, x, y, rot = 0, opts = {}) {
  const check = validatePlacement(s, level, type, x, y, opts);
  if (!check.ok) return check;
  const def = BUILDINGS[type];
  if (!opts.free) s.coins -= def.cost;
  const o = createObject(type, x, y, rot);
  o.id = s.nextObjectId++;
  o.fixed = !!opts.free;
  s.objects.push(o);
  if (!opts.silent) s.dirty = true;
  return { ok: true, object: o };
}

export function placeBelt(s, level, x, y, dir = 0, opts = {}) {
  if (!isBuildable(level, x, y)) return { ok: false, reason: 'Outside the buildable area' };
  if (occupiedBy(s, x, y)) {
    const occ = occupiedBy(s, x, y);
    return { ok: false, reason: `Blocked by ${occ.type ? BUILDINGS[occ.type].name : 'Belt'}` };
  }
  const cost = BUILDINGS.belt.cost;
  if (!opts.free && s.coins < cost) return { ok: false, reason: `Not enough coins (need ${cost})` };
  if (!opts.free) {
    s.coins -= cost;
    s.counters.beltsPlaced++;
  }
  s.belts[tileKey(x, y)] = { x, y, dir: dir % 4, item: null, preplaced: !!opts.preplaced };
  s.dirty = true;
  return { ok: true };
}

export function removeBelt(s, x, y) {
  const b = beltAt(s, x, y);
  if (!b) return false;
  delete s.belts[tileKey(x, y)];
  s.dirty = true;
  return true;
}

export function refundFor(type) {
  return Math.round(BUILDINGS[type].cost * SIM.sellRefund);
}

// Everything held inside a machine: source lanes, input sockets and the output rack.
export function contentsOf(o) {
  const out = [];
  if (!o) return out;
  for (const lane of o.lanes || []) out.push(...lane.buf);
  for (const sock of o.inputs || []) out.push(...sock.buf);
  for (const it of o.output || []) out.push(it);
  return out;
}

export function sellObject(s, level, id) {
  const idx = s.objects.findIndex(o => o.id === id);
  if (idx < 0) return { ok: false, reason: 'Object not found' };
  const o = s.objects[idx];
  if (o.fixed) return { ok: false, reason: 'This part of the workshop is fixed' };
  const refund = refundFor(o.type);
  const lost = contentsOf(o).length;
  s.coins += refund;
  if (BUILDINGS[o.type].kind !== 'source') s.counters.soldMachines++;
  s.counters.itemsDiscarded += lost;
  s.objects.splice(idx, 1);
  s.dirty = true;
  return { ok: true, refund, lost };
}

export function sellBelt(s, x, y) {
  const b = beltAt(s, x, y);
  if (!b) return { ok: false };
  if (b.preplaced) return { ok: false, reason: 'This belt is a fixed part of the workshop' };
  const refund = refundFor('belt');
  s.coins += refund;
  if (b.item) s.counters.itemsDiscarded++;
  delete s.belts[tileKey(x, y)];
  s.counters.beltsPlaced = Math.max(0, s.counters.beltsPlaced - 1);
  s.dirty = true;
  return { ok: true, refund };
}

export function buyCream(s, level, id) {
  const o = objectById(s, id);
  if (!o || o.type !== 'dairyCrate') return { ok: false, reason: 'No Dairy Crate selected' };
  if (s.coins < SIM.creamPrice) return { ok: false, reason: `Need ${SIM.creamPrice} coins` };
  if (s.creamBought >= level.creamCap) return { ok: false, reason: `Cream cap reached (${level.creamCap})` };
  const lane = o.lanes[0];
  if (!lane || lane.buf.length >= lane.buffer) return { ok: false, reason: 'Crate output is full' };
  s.coins -= SIM.creamPrice;
  s.creamBought++;
  s.counters.creamPurchased++;
  lane.buf.push({ type: 'cream', fresh: null, melt: null });
  s.dirty = true;
  return { ok: true };
}

export function upgradeSpeed(s, id) {
  const o = objectById(s, id);
  // Counters also have inputs, but they do not have speed levels.
  if (!o || !BUILDINGS[o.type] || BUILDINGS[o.type].kind !== 'machine') return { ok: false, reason: 'No machine selected' };
  const lvl = o.speedLvl || 0;
  if (lvl >= UPGRADES.speed.max) return { ok: false, reason: 'Speed is fully upgraded' };
  const cost = UPGRADES.speed.costs[lvl];
  if (s.coins < cost) return { ok: false, reason: `Need ${cost} coins` };
  s.coins -= cost;
  o.speedLvl = lvl + 1;
  s.dirty = true;
  return { ok: true };
}

export function upgradeCooling(s, id) {
  const o = objectById(s, id);
  if (!o || o.type !== 'freezer') return { ok: false, reason: 'No Freezer selected' };
  if (o.coolingLvl >= UPGRADES.cooling.max) return { ok: false, reason: 'Cooling is fully upgraded' };
  const cost = UPGRADES.cooling.costs[0];
  if (s.coins < cost) return { ok: false, reason: `Need ${cost} coins` };
  s.coins -= cost;
  o.coolingLvl++;
  o.outCap = 8;
  s.dirty = true;
  return { ok: true };
}

export function describeSockets(o) {
  if (!o.inputs) return [];
  return o.inputs.map(sock => ({ ...sock }));
}

export function socketEdge(o, index) {
  if (!o.inputs) return null;
  if (o.inputs.length === 1) return opp(o.rot);
  if (index === 0) return opp(o.rot);
  return (o.rot + 1) % 4;
}

export function outputEdge(o) {
  if (o.type === 'freezer' || BUILDINGS[o.type].kind === 'machine') return o.rot;
  if (BUILDINGS[o.type].kind === 'source') return (EDGE_DIR[BUILDINGS[o.type].outputs[0].edge] + o.rot) % 4;
  return null;
}

export function machineTiming(o, baseTicks) {
  return Math.max(1, Math.round(baseTicks * Math.pow(0.8, o.speedLvl || 0)));
}

// ---------------------------------------------------------------- stall diagnosis
// FR-13 wants the inspector to name a blockage *and* light up the belt path it
// affects; §6.8 wants a jump-to target for every shortage. Both read this one trace,
// so the highlight and the jump can never disagree about where the problem is.

const TRACE_LIMIT = 64;

function beltFeeding(s, x, y) {
  for (let d = 0; d < 4; d++) {
    const [dx, dy] = DIR_VEC[d];
    const b = s.belts[tileKey(x - dx, y - dy)];
    if (b && b.dir === d) return b;
  }
  return null;
}

function runBackwards(s, start) {
  const tiles = [];
  let cur = start;
  while (cur && tiles.length < TRACE_LIMIT) {
    if (tiles.some(t => t.x === cur.x && t.y === cur.y)) break;
    tiles.unshift({ x: cur.x, y: cur.y });
    cur = beltFeeding(s, cur.x, cur.y);
  }
  return tiles;
}

function runForwards(s, x, y) {
  const tiles = [];
  let cur = s.belts[tileKey(x, y)];
  while (cur && tiles.length < TRACE_LIMIT) {
    if (tiles.some(t => t.x === cur.x && t.y === cur.y)) break;
    tiles.push({ x: cur.x, y: cur.y });
    cur = s.belts[tileKey(cur.x + DIR_VEC[cur.dir][0], cur.y + DIR_VEC[cur.dir][1])];
  }
  return tiles;
}

// Belts sitting on an object edge that carry items *away* from that edge.
function beltsAwayFrom(s, o, edge) {
  const out = [];
  for (const [tx, ty] of edgeTiles(o, edge)) {
    const b = s.belts[tileKey(tx, ty)];
    if (b && b.dir !== opp(edge)) out.push(b);
  }
  return out;
}

// Belts sitting on an object edge that push items *into* that edge.
function beltsInto(s, o, edge) {
  const out = [];
  for (const [tx, ty] of edgeTiles(o, edge)) {
    const b = s.belts[tileKey(tx, ty)];
    if (b && b.dir === opp(edge)) out.push(b);
  }
  return out;
}

export function laneDropTile(o, lane) {
  const dir = (EDGE_DIR[lane.edge] + (BUILDINGS[o.type].rotatable ? o.rot : 0)) % 4;
  const [dx, dy] = DIR_VEC[dir];
  return { x: o.x + lane.tile[0] + dx, y: o.y + lane.tile[1] + dy, dir };
}

export function producerObjects(s, type) {
  return s.objects.filter(o => {
    if (o.lanes) return o.lanes.some(l => l.item === type);
    if (o.inputs) return RECIPES.some(r => r.machine === o.type && r.out === type);
    return false;
  });
}

export function supplierFor(s, type) {
  const built = producerObjects(s, type);
  if (built.length) {
    const stuck = built.find(o => o.state === 'blocked');
    return { kind: 'object', id: (stuck || built[0]).id, item: type };
  }
  for (const [key, def] of Object.entries(BUILDINGS)) {
    if (def.kind !== 'source') continue;
    if ((def.outputs || []).some(l => l.item === type)) {
      return { kind: 'build', building: key, item: type, label: def.name };
    }
  }
  const machine = RECIPES.find(r => r.out === type);
  if (machine) {
    return { kind: 'build', building: machine.machine, item: type, label: BUILDINGS[machine.machine].name };
  }
  return null;
}

function dedupe(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const t of list) if (!seen.has(tileKey(t.x, t.y))) seen.set(tileKey(t.x, t.y), t);
  }
  return [...seen.values()];
}

export function stallReport(s, sel) {
  const none = { tone: '', tiles: [], note: '', jump: null };
  if (!s || !sel) return none;

  if (sel.kind === 'belt') {
    const b = s.belts[tileKey(sel.x, sel.y)];
    if (!b) return none;
    const nx = b.x + DIR_VEC[b.dir][0];
    const ny = b.y + DIR_VEC[b.dir][1];
    const back = runBackwards(s, beltFeeding(s, b.x, b.y));
    if (b.item && b.item.blocked) {
      const queue = back.length;
      const aheadObj = objectAt(s, nx, ny);
      return {
        tone: 'blocked',
        tiles: dedupe(back, [{ x: b.x, y: b.y }]),
        note: queue
          ? `${queue} belt tile${queue === 1 ? '' : 's'} behind it are stuck too.`
          : 'Nothing is waiting behind it yet.',
        jump: s.belts[tileKey(nx, ny)]
          ? { kind: 'belt', x: nx, y: ny }
          : aheadObj ? { kind: 'object', id: aheadObj.id } : null,
      };
    }
    return { tone: 'flow', tiles: dedupe(back, [{ x: b.x, y: b.y }], runForwards(s, nx, ny)), note: '', jump: null };
  }

  const o = s.objects.find(x => x.id === sel.id);
  if (!o) return none;
  const kind = BUILDINGS[o.type].kind;

  if (kind === 'machine') {
    const outFull = o.state === 'blocked' || (o.outCap && o.output.length >= o.outCap);
    if (outFull && o.output.length) {
      const runs = [];
      for (const start of beltsAwayFrom(s, o, outputEdge(o))) runs.push(runForwards(s, start.x, start.y));
      const tiles = dedupe(...runs);
      const last = tiles.length ? tiles[tiles.length - 1] : null;
      const lb = last ? s.belts[tileKey(last.x, last.y)] : null;
      const blockedAhead = lb ? objectAt(s, lb.x + DIR_VEC[lb.dir][0], lb.y + DIR_VEC[lb.dir][1]) : null;
      const note = tiles.length
        ? `${tiles.length} belt tile${tiles.length === 1 ? '' : 's'} cannot drain.`
        : 'The output has no belt, so nothing can leave this machine.';
      // With no belt at all there is no run to trace, so point at the port itself.
      return {
        tone: 'blocked',
        tiles: tiles.length ? tiles : edgeTiles(o, outputEdge(o)).map(([x, y]) => ({ x, y })),
        note,
        jump: blockedAhead
          ? { kind: 'object', id: blockedAhead.id }
          : last ? { kind: 'belt', x: last.x, y: last.y } : null,
      };
    }
    if (!o.recipe && o.state !== 'working') {
      const runs = [];
      let starvedSocket = null;
      o.inputs.forEach((sock, i) => {
        if (sock.buf.length) return;
        const edge = socketEdge(o, i);
        const feeders = beltsInto(s, o, edge);
        if (feeders.length) for (const f of feeders) runs.push(runBackwards(s, f));
        else runs.push(edgeTiles(o, edge).map(([x, y]) => ({ x, y })));
        if (!starvedSocket) starvedSocket = sock;
      });
      if (!starvedSocket) return none;
      const fam = FAMILIES[starvedSocket.family];
      const wanted = fam && fam.accepts.find(t => ITEMS[t]);
      return {
        tone: 'starved',
        tiles: dedupe(...runs),
        note: starvedSocket.label
          ? `Socket ${starvedSocket.label} is empty and needs ${fam ? fam.label.toLowerCase() : 'an input'}.`
          : 'This socket is empty.',
        jump: wanted ? supplierFor(s, wanted) : null,
      };
    }
    return none;
  }

  if (kind === 'counter') {
    const buf = o.inputs[0].buf;
    const unwanted = buf.filter(it => !s.orders.active.some(a =>
      !a.errand && a.items.some(x => x.type === it.type && x.need > 0)));
    if (!unwanted.length && buf.length < o.outCap) return none;
    const runs = [];
    for (const f of beltsInto(s, o, opp(o.rot))) runs.push(runBackwards(s, f));
    const tiles = dedupe(...runs);
    return {
      tone: 'blocked',
      tiles,
      note: tiles.length
        ? `${tiles.length} belt tile${tiles.length === 1 ? '' : 's'} backed up behind the counter.`
        : 'No belt feeds this counter yet.',
      jump: null,
    };
  }

  if (kind === 'source') {
    const stuck = o.lanes.filter(l => l.buf.length >= l.buffer);
    if (!stuck.length) return none;
    const runs = [];
    for (const lane of stuck) {
      const drop = laneDropTile(o, lane);
      const run = runForwards(s, drop.x, drop.y);
      runs.push(run.length ? run : [{ x: drop.x, y: drop.y }]);
    }
    const tiles = dedupe(...runs);
    const names = stuck.map(l => (ITEMS[l.item] ? ITEMS[l.item].name : 'supply')).join(' and ');
    return {
      tone: 'blocked',
      tiles,
      note: `${names} cannot leave — the lane buffer is full, so nothing downstream is fed.`,
      jump: null,
    };
  }

  return none;
}

// Save-shape guards. Saves are untrusted input (PRD §6.10).
export function sanitizeState(raw, level) {
  if (!raw || typeof raw !== 'object') return null;
  const s = createLevelState(level);
  s.coins = clampNum(raw.coins, 0, 999999, level.startingCoins);
  s.reputation = clampNum(raw.reputation, level.startingReputation, 99999, level.startingReputation);
  s.creamBought = clampNum(raw.creamBought, 0, level.creamCap, 0);
  s.nextObjectId = clampNum(raw.nextObjectId, 1, 1e6, 1);
  s.hintDismissed = !!raw.hintDismissed;
  s.trackers.completed = !!raw.trackers?.completed;
  s.trackers.optionalEarned = Array.isArray(raw.trackers?.optionalEarned) ? raw.trackers.optionalEarned.filter(x => typeof x === 'string') : [];
  s.trackers.recoveryUsed = !!raw.trackers?.recoveryUsed;
  s.trackers.elapsedTicks = clampNum(raw.trackers?.elapsedTicks, 0, 1e9, 0);
  s.trackers.longestBlock = clampNum(raw.trackers?.longestBlock, 0, 1e9, 0);

  if (raw.counters && typeof raw.counters === 'object') {
    for (const k of Object.keys(s.counters)) {
      if (typeof raw.counters[k] === 'number' && Number.isFinite(raw.counters[k])) {
        s.counters[k] = Math.max(0, Math.floor(raw.counters[k]));
      }
    }
    if (raw.counters.byType && typeof raw.counters.byType === 'object') {
      for (const [k, v] of Object.entries(raw.counters.byType)) {
        if (ITEMS[k] && Number.isFinite(v)) s.counters.byType[k] = Math.max(0, Math.floor(v));
      }
    }
  }

  s.objects = [];
  const taken = new Set();
  // Fixed pieces are owned by the level, not the save. Reserve their tiles so a
  // corrupt object cannot squat on the counter's footprint and stop the repair
  // below from putting the counter back.
  const reserved = new Set();
  for (const p of level.preplaced || []) {
    for (const [tx, ty] of footprintTiles(p.type, p.x, p.y)) reserved.add(tileKey(tx, ty));
  }
  for (const b of level.preBelts || []) reserved.add(tileKey(b.x, b.y));
  const freeTiles = (type, x, y) => {
    for (const [tx, ty] of footprintTiles(type, x, y)) {
      // A 2x2 anchor can pass the grid test while its body hangs off the map.
      if (!isBuildable(level, tx, ty) || taken.has(tileKey(tx, ty))) return false;
    }
    return true;
  };
  for (const ro of Array.isArray(raw.objects) ? raw.objects : []) {
    if (!ro || !BUILDINGS[ro.type]) continue;
    const def = BUILDINGS[ro.type];
    if (def.kind === 'belt') continue;
    const x = ro.x | 0;
    const y = ro.y | 0;
    const isPreplaced = (level.preplaced || []).some(p => p.type === ro.type && p.x === x && p.y === y);
    if (!isPreplaced && footprintTiles(ro.type, x, y).some(([tx, ty]) => reserved.has(tileKey(tx, ty)))) continue;
    if (!freeTiles(ro.type, x, y)) continue;
    const o = createObject(ro.type, x, y, dir4(ro.rot));
    o.id = ro.id | 0 || s.nextObjectId++;
    if (s.objects.some(other => other.id === o.id)) o.id = s.nextObjectId;
    for (const [tx, ty] of footprintTiles(ro.type, x, y)) taken.add(tileKey(tx, ty));
    o.fixed = !!(level.preplaced || []).some(p => p.type === o.type && p.x === o.x && p.y === o.y);
    o.speedLvl = clampNum(ro.speedLvl, 0, 2, 0);
    o.coolingLvl = clampNum(ro.coolingLvl, 0, 1, 0);
    if (o.type === 'freezer' && o.coolingLvl) o.outCap = 8;
    if (o.lanes) {
      o.lanes.forEach((lane, i) => {
        const rl = ro.lanes?.[i];
        if (rl && Array.isArray(rl.buf)) {
          lane.buf = rl.buf.filter(it => it && ITEMS[it.type]).slice(0, lane.buffer)
            .map(it => ({ type: it.type, fresh: numOrNull(it.fresh), melt: numOrNull(it.melt), refreezeCount: clampNum(it.refreezeCount, 0, SIM.maxRefreezeCycles, 0) }));
          lane.timer = clampNum(rl.timer, 0, 9999, lane.every);
        }
      });
    }
    if (o.inputs) {
      o.inputs.forEach((sock, i) => {
        const rs = ro.inputs?.[i];
        if (rs && Array.isArray(rs.buf)) {
          sock.buf = rs.buf.filter(it => it && ITEMS[it.type]).slice(0, 2)
            .map(it => ({ type: it.type, fresh: numOrNull(it.fresh), melt: numOrNull(it.melt), refreezeCount: clampNum(it.refreezeCount, 0, SIM.maxRefreezeCycles, 0) }));
        }
      });
    }
    if (o.output) {
      o.output = Array.isArray(ro.output)
        ? ro.output.filter(it => it && ITEMS[it.type]).slice(0, o.outCap).map(it => ({ type: it.type, refreezeCount: clampNum(it.refreezeCount, 0, SIM.maxRefreezeCycles, 0) }))
        : [];
      o.progress = clampNum(ro.progress, 0, 99999, 0);
      o.recipe = typeof ro.recipe === 'string' ? ro.recipe : null;
      o.recipeTicks = clampNum(ro.recipeTicks, 0, 99999, 0);
      o.recipeRefreezeCount = clampNum(ro.recipeRefreezeCount, 0, SIM.maxRefreezeCycles, ro.recipe === 'R8m' ? 1 : 0);
      o.state = 'idle';
    }
    s.objects.push(o);
    s.nextObjectId = Math.max(s.nextObjectId, o.id + 1);
  }

  // Fixed pieces belong to the level, not to the player's save. Put back any that
  // are missing (old save, changed level data, or a partially written document)
  // so the level cannot load without its counter or fixed belts.
  for (const p of level.preplaced || []) {
    const present = s.objects.some(o => o.type === p.type && o.x === p.x && o.y === p.y);
    if (present) continue;
    const res = placeObject(s, level, p.type, p.x, p.y, p.rot || 0, { free: true, silent: true });
    if (res.ok) {
      for (const [tx, ty] of footprintTiles(p.type, p.x, p.y)) taken.add(tileKey(tx, ty));
    }
  }

  s.belts = {};
  for (const rb of Array.isArray(raw.belts) ? raw.belts : []) {
    const bx = rb && rb.x | 0;
    const by = rb && rb.y | 0;
    if (!rb || !isBuildable(level, bx, by) || taken.has(tileKey(bx, by))) continue;
    const item = rb.item && ITEMS[rb.item.type] ? {
      type: rb.item.type,
      fresh: numOrNull(rb.item.fresh),
      melt: numOrNull(rb.item.melt),
      refreezeCount: clampNum(rb.item.refreezeCount, 0, SIM.maxRefreezeCycles, 0),
      progress: clampNum(rb.item.progress, 0, 1, 0),
      blocked: !!rb.item.blocked,
      blockedReason: typeof rb.item.blockedReason === 'string' ? rb.item.blockedReason : '',
      warned: !!rb.item.warned,
    } : null;
    s.belts[tileKey(bx, by)] = { x: bx, y: by, dir: dir4(rb.dir), item, preplaced: !!rb.preplaced };
  }

  // Re-add fixed belts too, and mark any saved copies as fixed.
  for (const b of level.preBelts || []) {
    const key = tileKey(b.x, b.y);
    const existing = s.belts[key];
    if (existing) {
      existing.preplaced = true;
      continue;
    }
    if (!isBuildable(level, b.x, b.y) || objectAt(s, b.x, b.y)) continue;
    s.belts[key] = { x: b.x, y: b.y, dir: dir4(b.dir), item: null, preplaced: true };
  }

  const active = Array.isArray(raw.orders?.active) ? raw.orders.active : [];
  s.orders.active = active.filter(o => o && Array.isArray(o.items)).map(o => ({
    uid: String(o.uid || Math.random()),
    templateId: String(o.templateId || ''),
    items: o.items.filter(it => it && ITEMS[it.type])
      .map(it => ({ type: it.type, qty: Math.max(1, it.qty | 0), need: Math.max(0, it.need | 0) })),
    reward: clampNum(o.reward, 0, 9999, 0),
    rep: clampNum(o.rep, 0, 99, 0),
    patienceMax: clampNum(o.patienceMax, 1, 99999, 120),
    remaining: clampNum(o.remaining, 0, 999999, 120),
    createdAt: clampNum(o.createdAt, 0, 1e9, 0),
    errand: !!o.errand,
    sent: !!o.sent,
    // A queue card nobody can ever serve would only cost the player reputation.
  })).filter(o => o.items.some(it => it.need > 0));
  s.orders.queueIndex = clampNum(raw.orders?.queueIndex, 0, level.town ? 1e9 : level.orderPool.length, 0);
  s.orders.spawnTimer = clampNum(raw.orders?.spawnTimer, 0, 9999, 0);
  s.orders.errand = null;
  const re = raw.orders && raw.orders.errand;
  if (re && typeof re === 'object' && Number.isFinite(re.remaining)) {
    s.orders.errand = {
      sent: !!re.sent,
      remaining: clampNum(re.remaining, 0, 3600, 300),
      reward: clampNum(re.reward, 0, 99, ECONOMY.errand.reward),
    };
  }
  return s;
}

function dir4(v) {
  return ((v | 0) % 4 + 4) % 4;
}

function clampNum(v, lo, hi, fallback) {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
}
function numOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : null;
}
