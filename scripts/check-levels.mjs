// Static validation for the authored content. Run with `npm run check:levels`.
// This is intentionally dependency-free: it reads the same data the game ships,
// so a typo in a level fails the build before a player sees it.

import { LEVELS, LEVEL_BY_ID, LEVEL_ORDER, isBuildable } from '../src/data/levels.js';
import { BUILDINGS, BUILD_ORDER, RECIPES } from '../src/data/buildings.js';
import { ITEMS, FAMILIES, familyAccepts } from '../src/data/items.js';
import { DIR_VEC, EDGE_DIR, opp, tileOnEdge } from '../src/core/iso.js';
import { footprintTiles } from '../src/core/state.js';
import { TOWN_ORDER_POOL, MAX_TOWN_LEVEL } from '../src/core/town.js';

const errors = [];
const warnings = [];
const fail = message => errors.push(message);
const warn = message => warnings.push(message);
const isInt = value => Number.isInteger(value);
const isPositiveInt = value => Number.isInteger(value) && value > 0;
const isNonNegativeInt = value => Number.isInteger(value) && value >= 0;

// ---------------------------------------------------------------- catalog

function checkCatalogue() {
  const buildingIds = Object.keys(BUILDINGS);
  if (new Set(BUILD_ORDER).size !== BUILD_ORDER.length) fail('BUILD_ORDER contains duplicates');
  for (const id of BUILD_ORDER) {
    if (!BUILDINGS[id]) fail(`BUILD_ORDER references unknown building "${id}"`);
  }
  for (const id of buildingIds) {
    if (!BUILD_ORDER.includes(id)) fail(`building "${id}" is missing from BUILD_ORDER`);
  }

  for (const [id, def] of Object.entries(BUILDINGS)) {
    const at = `building "${id}"`;
    if (def.id !== id) fail(`${at}: id does not match its key`);
    if (typeof def.name !== 'string' || !def.name.trim()) fail(`${at}: missing name`);
    if (!isNonNegativeInt(def.cost)) fail(`${at}: cost must be a non-negative integer`);
    if (!isPositiveInt(def.w) || !isPositiveInt(def.h)) fail(`${at}: footprint must be positive integers`);
    if (!['source', 'machine', 'counter', 'belt'].includes(def.kind)) fail(`${at}: unknown kind "${def.kind}"`);
    if (typeof def.cat !== 'string' || !def.cat.trim()) fail(`${at}: missing category`);

    if (def.kind === 'source') {
      if (!Array.isArray(def.outputs) || !def.outputs.length) fail(`${at}: a source needs at least one output`);
      for (const out of def.outputs || []) {
        if (!ITEMS[out.item]) fail(`${at}: output item "${out.item}" is unknown`);
        if (!(out.edge in EDGE_DIR)) fail(`${at}: output edge "${out.edge}" is invalid`);
        if (!Array.isArray(out.tile) || out.tile.length !== 2) fail(`${at}: output tile must be [x,y]`);
        else {
          const [tx, ty] = out.tile;
          if (tx < 0 || tx >= def.w || ty < 0 || ty >= def.h) fail(`${at}: output tile ${tx},${ty} is outside the footprint`);
        }
        if (!isPositiveInt(out.every) && !out.manual) fail(`${at}: output timer must be a positive integer`);
        if (!isPositiveInt(out.buffer)) fail(`${at}: output buffer must be a positive integer`);
      }
    }

    if (def.kind === 'machine') {
      if (!Array.isArray(def.inputs) || !def.inputs.length) fail(`${at}: a machine needs at least one input socket`);
      for (const sock of def.inputs || []) {
        if (!FAMILIES[sock.family]) fail(`${at}: input family "${sock.family}" is unknown`);
        if (sock.label != null && typeof sock.label !== 'string') fail(`${at}: socket label must be text`);
      }
      if (!isPositiveInt(def.outCap || 2)) fail(`${at}: output capacity must be a positive integer`);
    }

    if (def.kind === 'counter') {
      if (!Array.isArray(def.inputs) || def.inputs.length !== 1) fail(`${at}: a counter needs exactly one input socket`);
      for (const sock of def.inputs || []) {
        if (!FAMILIES[sock.family]) fail(`${at}: input family "${sock.family}" is unknown`);
      }
      if (!isPositiveInt(def.outCap || 2)) fail(`${at}: buffer capacity must be a positive integer`);
    }
  }

  const recipeIds = new Set();
  for (const recipe of RECIPES) {
    const at = `recipe "${recipe.id}"`;
    if (recipeIds.has(recipe.id)) fail(`${at}: duplicate id`);
    recipeIds.add(recipe.id);
    const machine = BUILDINGS[recipe.machine];
    if (!machine) fail(`${at}: unknown machine "${recipe.machine}"`);
    else if (machine.kind !== 'machine') fail(`${at}: "${recipe.machine}" is not a machine`);
    if (!ITEMS[recipe.out]) fail(`${at}: unknown output item "${recipe.out}"`);
    if (!isPositiveInt(recipe.ticks)) fail(`${at}: ticks must be a positive integer`);
    if (!Array.isArray(recipe.inputs) || !recipe.inputs.length) {
      fail(`${at}: needs at least one input`);
      continue;
    }
    if (machine && recipe.inputs.length !== machine.inputs.length) {
      fail(`${at}: ${recipe.inputs.length} inputs but ${recipe.machine} has ${machine.inputs.length} sockets`);
    }
    recipe.inputs.forEach((item, i) => {
      if (!ITEMS[item]) fail(`${at}: unknown input item "${item}"`);
      const family = machine?.inputs?.[i]?.family;
      if (family && !familyAccepts(family, item)) fail(`${at}: socket ${i + 1} (${family}) does not accept ${item}`);
    });
  }

  for (const [id, family] of Object.entries(FAMILIES)) {
    if (family.id !== id) fail(`family "${id}": id does not match its key`);
    if (!Array.isArray(family.accepts) || !family.accepts.length) fail(`family "${id}": no accepted items`);
    for (const item of family.accepts || []) {
      if (!ITEMS[item]) fail(`family "${id}": unknown item "${item}"`);
    }
  }
}

// ---------------------------------------------------------------- layouts

function socketIndexForEdge(def, rot, edge) {
  if (def.inputs.length === 1) return opp(rot) === edge ? 0 : -1;
  return def.inputs.findIndex((_, i) => (i === 0 ? opp(rot) : (rot + 1) % 4) === edge);
}

function checkLayout(level) {
  const at = `level "${level.id}"`;
  const owners = new Map();
  const objects = [];

  for (const p of level.preplaced || []) {
    const def = BUILDINGS[p.type];
    if (!def) { fail(`${at}: preplaced object type "${p.type}" is unknown`); continue; }
    if (def.kind === 'belt') { fail(`${at}: use preBelts for fixed belts, not preplaced`); continue; }
    if (!isInt(p.x) || !isInt(p.y)) { fail(`${at}: preplaced ${p.type} needs integer coordinates`); continue; }
    if (!isInt(p.rot ?? 0) || (p.rot ?? 0) < 0 || (p.rot ?? 0) > 3) fail(`${at}: preplaced ${p.type} has an invalid rotation`);
    for (const [tx, ty] of footprintTiles(p.type, p.x, p.y)) {
      if (!isBuildable(level, tx, ty)) fail(`${at}: preplaced ${p.type} at ${p.x},${p.y} is outside the buildable field`);
      if (owners.has(`${tx},${ty}`)) fail(`${at}: preplaced ${p.type} overlaps ${owners.get(`${tx},${ty}`)} at ${tx},${ty}`);
      owners.set(`${tx},${ty}`, `${p.type} at ${p.x},${p.y}`);
    }
    objects.push(p);
  }

  const beltKeys = new Map();
  for (const b of level.preBelts || []) {
    if (!isInt(b.x) || !isInt(b.y)) { fail(`${at}: fixed belt needs integer coordinates`); continue; }
    if (!isInt(b.dir) || b.dir < 0 || b.dir > 3) fail(`${at}: fixed belt at ${b.x},${b.y} has an invalid direction`);
    if (!isBuildable(level, b.x, b.y)) fail(`${at}: fixed belt at ${b.x},${b.y} is outside the buildable field`);
    const key = `${b.x},${b.y}`;
    if (owners.has(key)) fail(`${at}: fixed belt at ${b.x},${b.y} overlaps ${owners.get(key)}`);
    if (beltKeys.has(key)) fail(`${at}: duplicate fixed belt at ${b.x},${b.y}`);
    beltKeys.set(key, b);
  }

  // Every fixed belt should flow into a belt or a valid input socket. A line that
  // points off the map or into a wall is a layout bug, not a difficulty knob.
  for (const b of beltKeys.values()) {
    const [dx, dy] = DIR_VEC[b.dir];
    const tx = b.x + dx;
    const ty = b.y + dy;
    if (!isBuildable(level, tx, ty)) {
      fail(`${at}: fixed belt at ${b.x},${b.y} points off the buildable field`);
      continue;
    }
    const owner = owners.get(`${tx},${ty}`);
    if (owner) {
      const target = level.preplaced.find(o =>
        tx >= o.x && tx < o.x + BUILDINGS[o.type].w && ty >= o.y && ty < o.y + BUILDINGS[o.type].h);
      if (!target) continue;
      const def = BUILDINGS[target.type];
      if (def.kind === 'source') {
        fail(`${at}: fixed belt at ${b.x},${b.y} points into the source ${target.type}`);
        continue;
      }
      const incoming = opp(b.dir);
      if (!tileOnEdge({ ...target, w: def.w, h: def.h }, tx, ty, incoming)) {
        fail(`${at}: fixed belt at ${b.x},${b.y} hits the side of ${target.type} with no socket`);
        continue;
      }
      if (!['machine', 'counter'].includes(def.kind)) continue;
      if (socketIndexForEdge(def, target.rot || 0, incoming) < 0) {
        fail(`${at}: fixed belt at ${b.x},${b.y} has no input socket on ${target.type} at ${tx},${ty}`);
      }
    } else if (beltKeys.has(`${tx},${ty}`)) {
      const next = beltKeys.get(`${tx},${ty}`);
      if (next.dir === opp(b.dir)) fail(`${at}: fixed belts at ${b.x},${b.y} and ${tx},${ty} face each other`);
    } else {
      warn(`${at}: fixed belt at ${b.x},${b.y} ends on an empty tile at ${tx},${ty}`);
    }
  }

  // A preplaced source or machine needs a usable port tile; an object parked on
  // the port would jam the layout before the player gets a turn.
  for (const p of objects) {
    const def = BUILDINGS[p.type];
    const rot = p.rot || 0;
    if (def.kind === 'source') {
      for (const lane of def.outputs) {
        const dir = (EDGE_DIR[lane.edge] + (def.rotatable ? rot : 0)) % 4;
        const tx = p.x + lane.tile[0] + DIR_VEC[dir][0];
        const ty = p.y + lane.tile[1] + DIR_VEC[dir][1];
        if (!isBuildable(level, tx, ty)) {
          fail(`${at}: ${p.type} at ${p.x},${p.y} drops ${lane.item} outside the buildable field`);
        } else if (owners.has(`${tx},${ty}`)) {
          fail(`${at}: ${p.type} at ${p.x},${p.y} drops ${lane.item} onto ${owners.get(`${tx},${ty}`)}`);
        }
      }
    } else if (def.kind === 'machine') {
      for (let y = p.y; y < p.y + def.h; y++) {
        for (let x = p.x; x < p.x + def.w; x++) {
          const port = rot === 0 ? x === p.x + def.w - 1
            : rot === 2 ? x === p.x
              : rot === 1 ? y === p.y + def.h - 1
                : y === p.y;
          if (!port) continue;
          const tx = rot === 0 ? x + 1 : rot === 2 ? x - 1 : x;
          const ty = rot === 1 ? y + 1 : rot === 3 ? y - 1 : y;
          if (owners.has(`${tx},${ty}`) && !beltKeys.has(`${tx},${ty}`)) {
            fail(`${at}: ${p.type} at ${p.x},${p.y} has an output port blocked by ${owners.get(`${tx},${ty}`)}`);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- reachability

function computeProducible(level) {
  const allowed = new Set([...(level.available || []), ...(level.preplaced || []).map(p => p.type)]);
  const sources = new Set();
  for (const type of allowed) {
    if (BUILDINGS[type]?.kind === 'source') sources.add(type);
  }
  const producible = new Set();
  for (const type of sources) {
    for (const out of BUILDINGS[type].outputs) producible.add(out.item);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const recipe of RECIPES) {
      if (!allowed.has(recipe.machine)) continue;
      if (recipe.inputs.every(item => producible.has(item)) && !producible.has(recipe.out)) {
        producible.add(recipe.out);
        changed = true;
      }
    }
  }
  return { allowed, sources, producible };
}

function requiredBuildings(level, producible, allowed, orderItems) {
  const preplaced = new Set((level.preplaced || []).map(p => p.type));
  const needed = new Set();
  const targets = new Set(orderItems);
  for (const type of Object.keys(level.objective?.byType || {})) targets.add(type);

  const visiting = new Set();
  const visit = item => {
    if (visiting.has(item)) return;
    visiting.add(item);
    const source = [...allowed].find(type =>
      BUILDINGS[type]?.kind === 'source' && BUILDINGS[type].outputs.some(out => out.item === item));
    if (source) {
      if (!preplaced.has(source)) needed.add(source);
    } else {
      const options = RECIPES.filter(r => r.out === item && allowed.has(r.machine));
      const recipe = options.find(r => r.inputs.every(input => producible.has(input))) || options[0];
      if (!recipe) {
        fail(`level "${level.id}": no allowed building produces ${item}`);
      } else {
        if (!preplaced.has(recipe.machine)) needed.add(recipe.machine);
        for (const input of recipe.inputs) visit(input);
      }
    }
    visiting.delete(item);
  };

  for (const item of targets) visit(item);
  return { needed, targets };
}

// What the customers of a level can actually ask for. Trail levels spell this out in an
// authored pool; Town mode generates its board from core/town.js instead.
function orderItemSet(level) {
  const items = new Set();
  if (level.town) {
    for (const entry of TOWN_ORDER_POOL) items.add(entry.type);
    return items;
  }
  for (const tpl of level.orderPool || []) {
    for (const item of tpl.items || []) items.add(item.type);
  }
  return items;
}

function checkReachability(level) {
  const at = `level "${level.id}"`;
  const { allowed, producible } = computeProducible(level);
  const orderItems = orderItemSet(level);

  for (const item of orderItems) {
    if (!producible.has(item)) fail(`${at}: order item "${item}" is not producible by the allowed buildings`);
  }
  for (const [item, count] of Object.entries(level.objective?.byType || {})) {
    if (!producible.has(item)) fail(`${at}: objective item "${item}" is not producible by the allowed buildings`);
    if (!orderItems.has(item)) fail(`${at}: objective needs ${count} × ${item}, but no order in the pool asks for it`);
  }
  if ((level.objective?.minBase || 0) > 0) {
    const baseItems = ['peachBase', 'appleBase'];
    if (!baseItems.some(item => orderItems.has(item))) fail(`${at}: minBase objective has no puree order in the pool`);
  }

  // The cost gate is about what the player must afford on entry. A trail level demands its
  // whole pool up front; Town mode unlocks products across 50 levels, so only the orders that
  // are already eligible at Town Level 1 have to be buildable from the starting coins.
  const opening = level.town
    ? new Set(TOWN_ORDER_POOL.filter(p => p.min <= 1).map(p => p.type))
    : orderItems;

  const { needed } = requiredBuildings(level, producible, allowed, opening);
  let cost = 0;
  for (const type of needed) {
    if (!allowed.has(type) && !(level.preplaced || []).some(p => p.type === type)) {
      fail(`${at}: needed building "${type}" is neither available nor preplaced`);
    }
    cost += BUILDINGS[type]?.cost || 0;
  }
  if (cost > level.startingCoins) {
    fail(`${at}: minimum build cost ${cost} exceeds starting coins ${level.startingCoins}`);
  } else if (cost > 0 && level.startingCoins - cost < level.startingCoins * 0.1) {
    warn(`${at}: only ${level.startingCoins - cost} coins (${Math.round((level.startingCoins - cost) / level.startingCoins * 100)}%) left after the required buildings`);
  }

  return { ordered: orderItems, needed, cost };
}

// Town mode has no authored pool: the board is generated by townTemplate from TOWN_ORDER_POOL,
// gated by Town Level. Validate that table instead of the empty level.orderPool.
function checkTownBoard(level) {
  const at = `level "${level.id}"`;
  if (!TOWN_ORDER_POOL.length) fail(`${at}: town order board is empty`);
  const seen = new Set();
  for (const entry of TOWN_ORDER_POOL) {
    if (!ITEMS[entry.type]) fail(`${at}: town board asks for unknown item "${entry.type}"`);
    if (seen.has(entry.type)) fail(`${at}: duplicate town board entry "${entry.type}"`);
    seen.add(entry.type);
    if (!isPositiveInt(entry.price)) fail(`${at}: town board ${entry.type} needs a positive price`);
    if (!isNonNegativeInt(entry.rep)) fail(`${at}: town board ${entry.type} needs a non-negative reputation reward`);
    if (!isPositiveInt(entry.min)) fail(`${at}: town board ${entry.type} needs a positive unlock level`);
    else if (entry.min > MAX_TOWN_LEVEL) fail(`${at}: town board ${entry.type} unlocks at ${entry.min}, above the max town level ${MAX_TOWN_LEVEL}`);
  }
  if (!TOWN_ORDER_POOL.some(p => p.min <= 1)) fail(`${at}: nothing is orderable at Town Level 1`);
}

// ---------------------------------------------------------------- levels

function checkLevel(level) {
  const at = `level "${level.id}"`;
  if (typeof level.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(level.id)) fail(`${at}: id must be lowercase words`);
  for (const field of ['name', 'chapter', 'intro']) {
    if (typeof level[field] !== 'string' || !level[field].trim()) fail(`${at}: missing ${field}`);
  }
  if (typeof level.num !== 'string' || !level.num.trim()) fail(`${at}: missing level number`);

  if (!isPositiveInt(level.gridW) || !isPositiveInt(level.gridH)) fail(`${at}: grid size must be positive integers`);
  if (!isNonNegativeInt(level.x0) || !isNonNegativeInt(level.y0)) fail(`${at}: field origin must be non-negative integers`);
  if (!isPositiveInt(level.x1) || !isPositiveInt(level.y1)) fail(`${at}: field bounds must be positive integers`);
  if (level.x0 > level.x1 || level.y0 > level.y1) fail(`${at}: field bounds are inverted`);
  if (level.x1 >= level.gridW || level.y1 >= level.gridH) fail(`${at}: field extends past the grid`);
  if (level.x1 < level.x0 || level.y1 < level.y0) fail(`${at}: field is empty`);

  if (!isNonNegativeInt(level.startingCoins)) fail(`${at}: starting coins must be a non-negative integer`);
  if (!isNonNegativeInt(level.startingReputation)) fail(`${at}: starting reputation must be a non-negative integer`);
  if (!isNonNegativeInt(level.creamCap)) fail(`${at}: cream cap must be a non-negative integer`);
  if (!isNonNegativeInt(level.expiryRep)) fail(`${at}: expiry reputation loss must be a non-negative integer`);

  if (!Array.isArray(level.blocked)) fail(`${at}: blocked areas must be an array`);
  else {
    for (const rect of level.blocked) {
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isInt)) {
        fail(`${at}: blocked area must be [x, y, w, h] integers`);
        continue;
      }
      const [bx, by, bw, bh] = rect;
      if (bw <= 0 || bh <= 0) fail(`${at}: blocked area has an empty size`);
      if (bx < 0 || by < 0 || bx + bw > level.gridW || by + bh > level.gridH) fail(`${at}: blocked area ${rect.join(',')} is outside the grid`);
    }
  }

  if (!Array.isArray(level.available) || !level.available.length) fail(`${at}: no available buildings`);
  else {
    for (const type of level.available) {
      if (!BUILDINGS[type]) fail(`${at}: available building "${type}" is unknown`);
    }
    if (!level.available.includes('belt')) warn(`${at}: belts are not in the available list`);
  }

  if (!Array.isArray(level.preplaced)) fail(`${at}: preplaced must be an array`);
  if (!Array.isArray(level.preBelts)) fail(`${at}: preBelts must be an array`);
  checkLayout(level);
  const hasCounter = (level.preplaced || []).some(p => p.type === 'counter');
  if (!hasCounter) fail(`${at}: no preplaced Service Counter`);

  const objective = level.objective;
  if (!objective || objective.kind !== 'orders') fail(`${at}: objective must be an order objective`);
  if (objective) {
    if (!isPositiveInt(objective.count)) fail(`${at}: objective count must be a positive integer`);
    if (typeof objective.text !== 'string' || !objective.text.trim()) fail(`${at}: objective needs text`);
    if (objective.byType != null && (typeof objective.byType !== 'object' || Array.isArray(objective.byType))) {
      fail(`${at}: objective byType must be an object`);
    }
    for (const [item, count] of Object.entries(objective.byType || {})) {
      if (!ITEMS[item]) fail(`${at}: objective byType item "${item}" is unknown`);
      if (!isPositiveInt(count)) fail(`${at}: objective byType count for ${item} must be a positive integer`);
    }
    if (objective.minBase != null && !isNonNegativeInt(objective.minBase)) fail(`${at}: minBase must be a non-negative integer`);
  }

  const optionalKinds = new Set(['noCustomerLeft', 'underTime', 'maxBelts', 'noBlock30', 'noRepLoss', 'noMelt', 'noSell']);
  const optionalIds = new Set();
  for (const opt of level.optional || []) {
    if (!optionalKinds.has(opt.kind)) fail(`${at}: unknown optional objective kind "${opt.kind}"`);
    if (typeof opt.id !== 'string' || !opt.id.trim()) fail(`${at}: optional objective needs an id`);
    else if (optionalIds.has(opt.id)) fail(`${at}: duplicate optional objective id "${opt.id}"`);
    optionalIds.add(opt.id);
    if (typeof opt.label !== 'string' || !opt.label.trim()) fail(`${at}: optional objective "${opt.id}" needs a label`);
    if (opt.kind === 'underTime' && !isPositiveInt(opt.seconds)) fail(`${at}: underTime needs a positive seconds value`);
    if (opt.kind === 'maxBelts' && !isPositiveInt(opt.n)) fail(`${at}: maxBelts needs a positive belt count`);
  }

  if (level.town) {
    checkTownBoard(level);
  } else {
    const orderIds = new Set();
    if (!Array.isArray(level.orderPool) || !level.orderPool.length) fail(`${at}: order pool is empty`);
    for (const tpl of level.orderPool || []) {
      if (typeof tpl.id !== 'string' || !tpl.id.trim()) fail(`${at}: order template needs an id`);
      else if (orderIds.has(tpl.id)) fail(`${at}: duplicate order id "${tpl.id}"`);
      orderIds.add(tpl.id);
      if (!Array.isArray(tpl.items) || !tpl.items.length) fail(`${at}: order "${tpl.id}" has no items`);
      for (const item of tpl.items || []) {
        if (!ITEMS[item.type]) fail(`${at}: order "${tpl.id}" asks for unknown item "${item.type}"`);
        if (!isPositiveInt(item.qty)) fail(`${at}: order "${tpl.id}" has a non-positive quantity`);
      }
      if (!isPositiveInt(tpl.reward)) fail(`${at}: order "${tpl.id}" needs a positive reward`);
      if (!isNonNegativeInt(tpl.rep)) fail(`${at}: order "${tpl.id}" needs a non-negative reputation reward`);
      if (!isPositiveInt(tpl.patience)) fail(`${at}: order "${tpl.id}" needs positive patience`);
      if (!isNonNegativeInt(tpl.gap)) fail(`${at}: order "${tpl.id}" needs a non-negative gap`);
    }
  }

  const stepKinds = new Set(['hasType', 'playerBelts', 'fulfilledType', 'boughtCream', 'levelDone']);
  if (!Array.isArray(level.tutorialSteps)) fail(`${at}: tutorialSteps must be an array`);
  for (const step of level.tutorialSteps || []) {
    if (typeof step.text !== 'string' || !step.text.trim()) fail(`${at}: tutorial step needs text`);
    if (!step.check || !stepKinds.has(step.check.kind)) fail(`${at}: tutorial step has an unknown check`);
    if (step.check?.kind === 'hasType' && !BUILDINGS[step.check.type]) fail(`${at}: tutorial step references unknown building "${step.check.type}"`);
    if (step.check?.kind === 'fulfilledType' && !ITEMS[step.check.type]) fail(`${at}: tutorial step references unknown item "${step.check.type}"`);
    if (step.check?.kind === 'playerBelts' && !isPositiveInt(step.check.n)) fail(`${at}: tutorial belt step needs a positive count`);
    for (const tile of step.tiles || []) {
      if (!Array.isArray(tile) || tile.length !== 2 || !tile.every(isInt)) fail(`${at}: tutorial step has an invalid tile`);
      else if (!isBuildable(level, tile[0], tile[1])) fail(`${at}: tutorial step tile ${tile.join(',')} is not buildable`);
    }
  }

  return checkReachability(level);
}

function checkUnlockChain() {
  if (!LEVELS.length) { fail('no levels are authored'); return; }
  const seen = new Set();
  let current = LEVELS[0].id;
  while (current) {
    if (seen.has(current)) { fail(`unlock chain loops at "${current}"`); break; }
    const level = LEVEL_BY_ID[current];
    if (!level) { fail(`unlock chain references unknown level "${current}"`); break; }
    seen.add(current);
    const next = level.unlockNext;
    if (next == null) break;
    if (next === level.id) { fail(`level "${level.id}" unlocks itself`); break; }
    if (!LEVEL_BY_ID[next]) { fail(`level "${level.id}" unlocks unknown level "${next}"`); break; }
    current = next;
  }
  for (const level of LEVELS) {
    if (!seen.has(level.id)) fail(`level "${level.id}" is unreachable from the unlock chain`);
  }
  if (LEVEL_ORDER.join('|') !== LEVELS.map(l => l.id).join('|')) fail('LEVEL_ORDER does not match LEVELS');
}

// ---------------------------------------------------------------- report

checkCatalogue();
checkUnlockChain();

const rows = [];
const levelIds = new Set();
for (const level of LEVELS) {
  if (levelIds.has(level.id)) fail(`duplicate level id "${level.id}"`);
  levelIds.add(level.id);
  const result = checkLevel(level);
  rows.push({
    id: level.id,
    start: level.startingCoins,
    cost: result?.cost ?? 0,
    margin: level.startingCoins - (result?.cost ?? 0),
    needed: [...(result?.needed || [])].join(', '),
  });
}

console.log('Little Batch Works — content check');
console.log('');
console.log('Level     Start  Required  Margin  Needed buildings');
for (const row of rows) {
  console.log(
    `${row.id.padEnd(9)} ${String(row.start).padStart(5)} ${String(row.cost).padStart(9)} ${String(row.margin).padStart(7)}  ${row.needed || '—'}`,
  );
}
console.log('');
console.log(`Checked ${LEVELS.length} levels, ${Object.keys(BUILDINGS).length} buildings, ${RECIPES.length} recipes.`);

if (warnings.length) {
  console.log('');
  console.log(`Warnings (${warnings.length}):`);
  for (const message of warnings) console.log(`  • ${message}`);
}

if (errors.length) {
  console.log('');
  console.log(`Errors (${errors.length}):`);
  for (const message of errors) console.log(`  ✗ ${message}`);
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Content OK.');
}
