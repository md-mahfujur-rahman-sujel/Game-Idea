import { BUILDINGS, RECIPES, SIM, ECONOMY } from '../data/buildings.js';
import { ITEMS, familyAccepts, orderDisplayName } from '../data/items.js';
import {
  DIR_VEC, opp, tileOnEdge, edgeTiles, EDGE_DIR,
} from './iso.js';
import { socketEdge, machineTiming, beltAt, objectAt } from './state.js';
import { evaluatePrimary, evaluateOptional } from './objectives.js';
import { townTemplate } from './town.js';

// ---------------------------------------------------------------- public

export function step(s, level, fx) {
  if (s.paused || s.trackers.completed) return;
  s.trackers.elapsedTicks++;

  tickOrders(s, level, fx);
  ageBeltItems(s, fx);
  moveBelts(s, level, fx);
  runSources(s, fx);
  runMachines(s, level, fx);
  ejectOutputs(s);
  tickErrand(s, fx);
  if (s.trackers.elapsedTicks % 10 === 0) checkRecovery(s, fx);

  if (!s.trackers.completed && evaluatePrimary(level, s)) {
    s.trackers.completed = true;
    s.levelDone = true;
    s.trackers.optionalEarned = (level.optional || [])
      .filter(o => evaluateOptional(o, s))
      .map(o => o.id);
    if (fx.onComplete) fx.onComplete();
    return;
  }

  if (!s.levelDone) {
    s.trackers.optionalEarned = (level.optional || [])
      .filter(o => evaluateOptional(o, s))
      .map(o => o.id);
  }
}

export function sendErrand(s) {
  if (!s.orders.errand || s.orders.errand.sent) return false;
  s.orders.errand.sent = true;
  return true;
}

export function removeBeltItem(s, x, y, fx) {
  const b = beltAt(s, x, y);
  if (!b || !b.item) return false;
  const nm = ITEMS[b.item.type].name;
  b.item = null;
  s.counters.itemsDiscarded++;
  s.dirty = true;
  if (fx) fx.toast('Item removed', `${nm} was discarded. The belt tile is free.`, 'warn');
  return true;
}

export function discardCounterItem(s, id, index) {
  const o = s.objects.find(o => o.id === id);
  if (!o || !o.inputs) return false;
  const buf = o.inputs[0].buf;
  if (index < 0 || index >= buf.length) return false;
  buf.splice(index, 1);
  s.counters.itemsDiscarded++;
  o.note = '';
  s.dirty = true;
  return true;
}

export function discardMachineInputItem(s, id, socketIndex, index) {
  const o = s.objects.find(o => o.id === id);
  const buf = o?.inputs?.[socketIndex]?.buf;
  if (!buf || index < 0 || index >= buf.length) return false;
  buf.splice(index, 1);
  s.counters.itemsDiscarded++;
  s.dirty = true;
  return true;
}

// ---------------------------------------------------------------- orders

function tickOrders(s, level, fx) {
  const active = s.orders.active;
  for (let i = active.length - 1; i >= 0; i--) {
    const order = active[i];
    if (order.errand) continue;
    order.remaining--;
    if (order.remaining <= 0) {
      active.splice(i, 1);
      s.counters.customerLeft++;
      if (level.expiryRep > 0) {
        s.reputation = Math.max(s.startingReputation, s.reputation - level.expiryRep);
        s.counters.repLoss += level.expiryRep;
      }
      if (fx) {
        fx.sfx('leave');
        fx.toast('A customer left', `${level.expiryRep > 0 ? 'Reputation −' + level.expiryRep + '. ' : ''}New orders keep coming; nothing else is lost.`, 'warn');
      }
    }
  }

  if (s.orders.spawnTimer > 0) s.orders.spawnTimer--;
  // The pool loops once spent, so expired customers can never leave the objective unreachable.
  if (s.orders.spawnTimer <= 0 && active.filter(o => !o.errand).length < (level.town ? (s.boardSlots || 3) : 3)) {
    const tpl = level.town ? townTemplate(s) : level.orderPool[s.orders.queueIndex % level.orderPool.length];
    s.orders.queueIndex++;
    active.push({
      uid: `${level.id}-${tpl.id}-${s.trackers.elapsedTicks}`,
      templateId: tpl.id,
      items: tpl.items.map(it => ({ type: it.type, qty: it.qty, need: it.qty })),
      reward: tpl.reward,
      rep: tpl.rep,
      patienceMax: tpl.patience,
      remaining: tpl.patience * 10,
      createdAt: s.trackers.elapsedTicks,
      errand: false,
    });
    if (level.town) {
      s.orders.spawnTimer = 120;
    } else {
      const next = level.orderPool[s.orders.queueIndex % level.orderPool.length];
      s.orders.spawnTimer = Math.max(16, next.gap) * 10;
    }
    if (fx) fx.sfx('customer');
  }
}

function tickErrand(s, fx) {
  const e = s.orders.errand;
  if (!e || !e.sent) return;
  e.remaining--;
  if (e.remaining <= 0) {
    s.coins += e.reward;
    s.orders.errand = null;
    if (fx) {
      fx.sfx('order');
      fx.toast('Market errand paid', `+${e.reward} coins. The workshop can keep going.`, 'good');
    }
  }
}

export function findOrderFor(s, itemType) {
  for (const o of s.orders.active) {
    if (o.errand) continue;
    if (o.items.some(it => it.need > 0 && it.type === itemType)) return o;
  }
  return null;
}

function counterIntake(s, level, counter, item, fx) {
  const order = findOrderFor(s, item.type);
  if (!order) {
    const sock = counter.inputs[0];
    sock.buf.push({ type: item.type, fresh: item.fresh ?? null, melt: item.melt ?? null, refreezeCount: item.refreezeCount ?? 0 });
    counter.note = 'Holds an item no order wants';
    if (fx) {
      fx.sfx('error');
      fx.toast('No order wants this', `${ITEMS[item.type].name} waits at the counter. Discard it from the counter panel.`, 'warn');
    }
    return;
  }

  const entry = order.items.find(it => it.need > 0 && it.type === item.type);
  entry.need--;
  if (order.items.every(it => it.need <= 0)) {
    fulfillOrder(s, level, order, fx);
  } else if (fx) {
    fx.sfx('good');
    fx.toast('Order progress', `${orderDisplayName(item.type)} delivered · ${order.items.map(it => it.need).reduce((a, b) => a + b, 0)} to go.`, 'good');
  }
}

// Buffered counter items are re-checked as new orders arrive, so a cup that
// waited as unwanted is never stranded forever.
function matchCounterBuffer(s, level, counter, fx) {
  const buf = counter.inputs[0].buf;
  for (let i = 0; i < buf.length; i++) {
    const it = buf[i];
    if (it.type === 'melted') {
      it.melt = (it.melt == null ? SIM.meltAutoDiscardTicks : it.melt) - 1;
      if (it.melt <= 0) {
        buf.splice(i, 1);
        i--;
        s.counters.itemsDiscarded++;
        if (fx) fx.toast('Melted mix cleared', 'The counter slot is free again.', 'warn');
        continue;
      }
    }
    const order = findOrderFor(s, it.type);
    if (!order) continue;
    buf.splice(i, 1);
    i--;
    const entry = order.items.find(x => x.need > 0 && x.type === it.type);
    entry.need--;
    if (order.items.every(x => x.need <= 0)) {
      fulfillOrder(s, level, order, fx);
    } else if (fx) {
      const left = order.items.reduce((a, x) => a + x.need, 0);
      fx.sfx('good');
      fx.toast('Order progress', `${orderDisplayName(it.type)} delivered · ${left} to go.`, 'good');
    }
  }
}

function fulfillOrder(s, level, order, fx) {
  const idx = s.orders.active.indexOf(order);
  if (idx >= 0) s.orders.active.splice(idx, 1);
  s.coins += order.reward;
  s.reputation += order.rep;
  s.counters.fulfilled++;
  let allFruit = true;
  let hasBase = false;
  let hasTea = false;
  let hasTub = false;
  for (const it of order.items) {
    s.counters.byType[it.type] = (s.counters.byType[it.type] || 0) + it.qty;
    if (it.type === 'washedPeach' || it.type === 'washedApple' || it.type === 'peachBase' || it.type === 'appleBase') {
      if (it.type === 'peachBase' || it.type === 'appleBase') hasBase = true;
    } else {
      allFruit = false;
    }
    if (it.type === 'brewedTea') hasTea = true;
    if (it.type === 'tub') hasTub = true;
  }
  if (allFruit) s.counters.fruitOrders++;
  if (hasBase) s.counters.baseOrders++;
  if (hasTea) s.counters.teaOrders++;
  if (hasTub) s.counters.tubOrders++;
  if (fx) {
    fx.sfx('order');
    if (fx.onOrder) fx.onOrder(order);
    fx.toast('Order served', `+${order.reward} coins · +${order.rep} reputation.`, 'good');
    if (fx.onSave) fx.onSave();
  }
}

// ---------------------------------------------------------------- belts

function ageBeltItems(s, fx) {
  for (const key of Object.keys(s.belts).sort()) {
    const b = s.belts[key];
    const it = b.item;
    if (!it) continue;
    if (it.type === 'tub' && it.fresh != null) {
      it.fresh--;
      if (!it.warned && it.fresh <= SIM.coldWarnTicks) {
        it.warned = true;
        if (fx) {
          fx.sfx('melt');
          fx.toast('Melting — reach the counter', `${ITEMS.tub.name} has 15 s of chill left.`, 'warn');
        }
      }
      if (it.fresh <= 0) {
        it.type = 'melted';
        it.fresh = null;
        it.warned = false;
        it.melt = SIM.meltAutoDiscardTicks;
        s.counters.melted++;
        if (fx) {
          fx.sfx('melt');
          const capped = (it.refreezeCount || 0) >= SIM.maxRefreezeCycles;
          fx.toast('Tub melted', capped
            ? 'This Melted Mix has reached its refreeze limit. Remove it or it clears in 15 s.'
            : 'It became Melted Mix. Re-freeze it, remove it, or it clears in 15 s.', 'warn');
        }
      }
    } else if (it.type === 'melted') {
      it.melt = (it.melt == null ? SIM.meltAutoDiscardTicks : it.melt) - 1;
      if (it.melt <= 0) {
        b.item = null;
        s.counters.itemsDiscarded++;
        if (fx) fx.toast('Melted mix cleared', 'The belt tile is free again.', 'warn');
      }
    }
  }
}

function moveBelts(s, level, fx) {
  for (const key of Object.keys(s.belts).sort()) {
    const b = s.belts[key];
    const it = b.item;
    if (!it) continue;

    if (!it.blocked) {
      it.progress = (it.progress || 0) + SIM.beltStep;
      // 0.1 added ten times is 0.9999999999999999 in floating point, so compare with a
      // small epsilon or every tile takes 11 ticks instead of the specified 10.
      if (it.progress < 1 - 1e-9) continue;
    }
    tryTransfer(s, level, b, it, fx);
  }
}

function block(b, reason) {
  b.item.progress = 1;
  b.item.blocked = true;
  b.item.blockedReason = reason;
}

function tryTransfer(s, level, b, it, fx) {
  const [dx, dy] = DIR_VEC[b.dir];
  const nx = b.x + dx;
  const ny = b.y + dy;

  const targetBelt = beltAt(s, nx, ny);
  if (targetBelt) {
    if (targetBelt.item) return block(b, 'Belt ahead is full');
    if (targetBelt.dir === opp(b.dir)) return block(b, 'Belts face each other');
    targetBelt.item = { ...it, progress: 0, blocked: false, blockedReason: '' };
    b.item = null;
    return;
  }

  const targetObj = objectAt(s, nx, ny);
  if (targetObj) {
    const def = BUILDINGS[targetObj.type];
    if (def.kind === 'counter') {
      const edge = opp(b.dir);
      if (!tileOnEdge(targetObj, nx, ny, edge)) return block(b, 'No socket on this side');
      const sock = targetObj.inputs[0];
      if (!familyAccepts(sock.family, it.type)) return block(b, `Counter does not take ${ITEMS[it.type].name}`);
      // Anything an order wants is served straight off the belt, so it can never be
      // held hostage by unwanted stock. Only an unwanted item needs a free slot, and
      // every buffered item is unwanted (the matcher drains the rest each tick).
      if (!findOrderFor(s, it.type) && sock.buf.length >= targetObj.outCap) {
        return block(b, 'Clear the unwanted item from the counter');
      }
      b.item = null;
      counterIntake(s, level, targetObj, it, fx);
      return;
    }
    if (def.kind === 'machine') {
      const edge = opp(b.dir);
      if (!tileOnEdge(targetObj, nx, ny, edge)) return block(b, 'No input socket on this side');
      const idx = targetObj.inputs.findIndex((sock, i) =>
        socketEdge(targetObj, i) === edge && familyAccepts(sock.family, it.type));
      if (idx < 0) {
        const edgeHasSocket = targetObj.inputs.some((sock, i) => socketEdge(targetObj, i) === edge);
        return block(b, edgeHasSocket ? 'Wrong item type for this socket' : 'No input socket on this side');
      }
      if (targetObj.type === 'freezer' && it.type === 'melted' && (it.refreezeCount || 0) >= SIM.maxRefreezeCycles) {
        return block(b, 'This Melted Mix has reached its refreeze limit');
      }
      const sock = targetObj.inputs[idx];
      if (sock.buf.length >= 2) return block(b, `${def.name} input is full`);
      b.item = null;
      sock.buf.push({ type: it.type, fresh: it.fresh ?? null, melt: it.melt ?? null, refreezeCount: it.refreezeCount ?? 0 });
      return;
    }
    return block(b, `${def.name} has no input`);
  }

  return block(b, 'No belt or machine ahead');
}

// ---------------------------------------------------------------- sources

function runSources(s, fx) {
  for (const o of s.objects) {
    if (!o.lanes) continue;
    for (const lane of o.lanes) {
      if (!lane.manual) {
        if (lane.buf.length < lane.buffer) {
          lane.timer--;
          if (lane.timer <= 0) {
            lane.buf.push({ type: lane.item, fresh: null, melt: null, refreezeCount: 0 });
            lane.timer = lane.every;
          }
        }
      }
      if (!lane.buf.length) continue;
      const rot = BUILDINGS[o.type].rotatable ? o.rot : 0;
      const dir = (EDGE_DIR[lane.edge] + rot) % 4;
      const [dx, dy] = DIR_VEC[dir];
      const tx = o.x + lane.tile[0] + dx;
      const ty = o.y + lane.tile[1] + dy;
      const belt = beltAt(s, tx, ty);
      if (belt && !belt.item) {
        const item = lane.buf.shift();
        belt.item = {
          type: item.type, progress: 0, fresh: null, melt: null, refreezeCount: item.refreezeCount || 0,
          blocked: false, blockedReason: '', warned: false,
        };
        if (fx && o.type !== 'dairyCrate') fx.sfx('produce');
      }
    }
  }
}

// ---------------------------------------------------------------- machines

function pickRecipe(o) {
  for (const r of RECIPES) {
    if (r.machine !== o.type) continue;
    if (r.inputs.length !== o.inputs.length) continue;
    let ok = true;
    for (let i = 0; i < r.inputs.length; i++) {
      const type = r.inputs[i];
      if (!o.inputs[i].buf.some(it => it.type === type && !(r.id === 'R8m' && (it.refreezeCount || 0) >= SIM.maxRefreezeCycles))) { ok = false; break; }
    }
    if (ok) return r;
  }
  return null;
}

function consumeInputs(o, recipe) {
  const consumed = [];
  for (let i = 0; i < recipe.inputs.length; i++) {
    const type = recipe.inputs[i];
    const buf = o.inputs[i].buf;
    const idx = buf.findIndex(it => it.type === type);
    if (idx >= 0) consumed[i] = buf.splice(idx, 1)[0];
  }
  return consumed;
}

function runMachines(s, level, fx) {
  for (const o of s.objects) {
    if (!o.inputs) continue;
    const def = BUILDINGS[o.type];
    if (def.kind === 'counter') {
      matchCounterBuffer(s, level, o, fx);
      const buf = o.inputs[0].buf;
      o.note = buf.length >= o.outCap ? 'Counter buffer is full' : '';
      if (buf.length) {
        const anyMatch = buf.some(it => !!findOrderFor(s, it.type));
        if (!anyMatch) o.note = 'Holds an item no order wants';
      }
      continue;
    }

    if (o.recipe) {
      if (o.output.length >= o.outCap) {
        o.state = 'blocked';
        o.reason = `${def.name} output full`;
      } else {
        o.state = 'working';
        o.reason = '';
        o.progress++;
        if (o.progress >= o.recipeTicks) {
          const rec = RECIPES.find(r => r.id === o.recipe);
          if (rec) {
            o.output.push({ type: rec.out, refreezeCount: rec.out === 'tub' ? (o.recipeRefreezeCount || 0) : 0 });
            if (fx) fx.sfx('complete');
          }
          o.recipe = null;
          o.recipeRefreezeCount = 0;
          o.progress = 0;
          o.state = 'idle';
        }
      }
    } else {
      const rec = o.output.length < o.outCap ? pickRecipe(o) : null;
      if (rec) {
        const consumed = consumeInputs(o, rec);
        o.recipeRefreezeCount = rec.id === 'R8m'
          ? Math.min(SIM.maxRefreezeCycles, (consumed[0]?.refreezeCount || 0) + 1)
          : 0;
        o.recipe = rec.id;
        o.recipeTicks = machineTiming(o, rec.ticks);
        o.progress = 0;
        o.state = 'working';
        o.reason = '';
      } else {
        o.state = o.output.length >= o.outCap && o.output.length > 0 ? 'blocked' : 'idle';
        if (o.output.length >= o.outCap) {
          o.reason = `${def.name} output full`;
        } else {
          const missing = o.inputs.map((sock, i) => {
            if (sock.buf.length) return null;
            return sock.label ? `socket ${sock.label}` : 'an ingredient';
          }).filter(Boolean);
          const cappedMelt = o.type === 'freezer' && o.inputs.some(sock => sock.buf.some(it => it.type === 'melted' && (it.refreezeCount || 0) >= SIM.maxRefreezeCycles));
          o.reason = cappedMelt
            ? 'Melted Mix has reached its refreeze limit; remove it from the input'
            : missing.length ? `Waiting for ${missing.join(' and ')}` : 'Waiting for a matching ingredient';
        }
      }
    }

    if (o.state === 'blocked') {
      o.blockedStreak++;
      if (o.blockedStreak > s.trackers.longestBlock) s.trackers.longestBlock = o.blockedStreak;
    } else {
      o.blockedStreak = 0;
    }
    // Waiting time makes the report useful without changing how the machine runs.
    if (o.state === 'idle') o.idleStreak = (o.idleStreak || 0) + 1;
    else o.idleStreak = 0;
  }
}

function ejectOutputs(s) {
  for (const o of s.objects) {
    if (!o.output || !o.output.length) continue;
    const dir = o.rot;
    for (const [tx, ty] of edgeTiles(o, dir)) {
      const b = beltAt(s, tx, ty);
      if (!b || b.item) continue;
      const item = o.output.shift();
      b.item = {
        type: item.type,
        progress: 0,
        fresh: item.type === 'tub'
          ? Math.max(SIM.coldFreshTicks - (item.refreezeCount || 0) * SIM.refreezeFreshnessLoss, SIM.coldFreshTicks - SIM.maxRefreezeCycles * SIM.refreezeFreshnessLoss)
          : null,
        melt: null,
        refreezeCount: item.refreezeCount || 0,
        blocked: false,
        blockedReason: '',
        warned: false,
      };
      break;
    }
  }
}

// ---------------------------------------------------------------- recovery

function hasGoods(s) {
  for (const b of Object.values(s.belts)) {
    if (b.item) return true;
  }
  for (const o of s.objects) {
    if (o.output && o.output.length) return true;
    // A source's own lane is raw supply that refills itself, not progress the player
    // can lose, so it must not count as goods when judging a dead end.
    if (o.inputs && o.inputs.some(sock => sock.buf.length)) return true;
    if (o.recipe) return true;
  }
  return false;
}

function checkRecovery(s, fx) {
  if (s.coins >= SIM.recoveryCoinThreshold) return;
  if (hasGoods(s)) return;
  if (!s.trackers.recoveryUsed) {
    s.trackers.recoveryUsed = true;
    s.coins += SIM.recoveryGrant;
    if (fx) {
      fx.sfx('unlock');
      fx.toast('A helping hand', `+${SIM.recoveryGrant} coins to get the workshop moving again.`, 'good');
    }
  }
  if (!s.orders.errand) {
    s.orders.errand = { sent: false, remaining: 300, reward: ECONOMY.errand.reward };
    if (fx) fx.toast('Market errand available', `Send the runner from the order panel to earn ${ECONOMY.errand.reward} coins.`, 'good');
  }
}
