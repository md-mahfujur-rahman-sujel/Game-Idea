import test from 'node:test';
import assert from 'node:assert/strict';

import { placeObject, placeBelt, beltAt } from '../src/core/state.js';
import { SIM } from '../src/data/buildings.js';
import { makeWorld, makeOrder, run, fxSpy } from './helpers.mjs';

function beltItem(s, x, y, item) {
  const belt = beltAt(s, x, y);
  assert.ok(belt, `expected a belt at ${x},${y}`);
  belt.item = item;
  return belt;
}

test('a belt item advances one tile every 10 ticks', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 5, 5, 0, { free: true });
  placeBelt(s, level, 6, 5, 0, { free: true });
  beltItem(s, 5, 5, { type: 'peach', progress: 0, fresh: null, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });

  run(s, level, 9);
  assert.ok(beltAt(s, 5, 5).item, 'the item is still on its first belt after 9 ticks');
  assert.equal(beltAt(s, 6, 5).item, null);

  run(s, level, 1);
  assert.equal(beltAt(s, 5, 5).item, null, 'the item left the first belt on tick 10');
  assert.equal(beltAt(s, 6, 5).item.type, 'peach');
});

test('a belt with nowhere to go blocks and explains why', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 5, 5, 0, { free: true });
  beltItem(s, 5, 5, { type: 'peach', progress: 0, fresh: null, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });

  run(s, level, 10);
  const belt = beltAt(s, 5, 5);
  assert.equal(belt.item.blocked, true);
  assert.equal(belt.item.progress, 1);
  assert.match(belt.item.blockedReason, /No belt or machine ahead/);
});

test('a belt facing an opposite belt reports the jam', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 5, 5, 0, { free: true });
  placeBelt(s, level, 6, 5, 2, { free: true });
  beltItem(s, 5, 5, { type: 'peach', progress: 0, fresh: null, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });

  run(s, level, 10);
  assert.equal(beltAt(s, 5, 5).item.blocked, true);
  assert.match(beltAt(s, 5, 5).item.blockedReason, /face each other/);
});

test('a source fills its lane and drops onto an empty belt', () => {
  const { level, s } = makeWorld();
  placeObject(s, level, 'orchard', 3, 4, 0, { free: true, silent: true });
  placeBelt(s, level, 3, 6, 0, { free: true });

  run(s, level, 59);
  assert.equal(beltAt(s, 3, 6).item, null, 'nothing leaves before the 6 second timer');

  run(s, level, 1);
  assert.equal(beltAt(s, 3, 6).item?.type, 'peach');
});

test('a washer consumes a peach and ejects a washed peach', () => {
  const { level, s } = makeWorld();
  const placed = placeObject(s, level, 'washer', 6, 5, 0, { free: true, silent: true });
  placeBelt(s, level, 7, 5, 0, { free: true });
  placed.object.inputs[0].buf.push({ type: 'peach', fresh: null, melt: null, refreezeCount: 0 });

  run(s, level, 30);
  assert.equal(placed.object.recipe, 'R1');
  assert.equal(beltAt(s, 7, 5).item, null);

  run(s, level, 1);
  assert.equal(placed.object.recipe, null);
  assert.equal(beltAt(s, 7, 5).item?.type, 'washedPeach');
});

test('a counter serves a matching order and pays out', () => {
  const { level, s } = makeWorld();
  placeObject(s, level, 'counter', 10, 5, 0, { free: true, silent: true });
  placeBelt(s, level, 9, 5, 0, { free: true });
  beltItem(s, 9, 5, { type: 'washedPeach', progress: 0, fresh: null, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });
  s.orders.active.push(makeOrder());

  const coins = s.coins;
  run(s, level, 10);

  assert.equal(s.counters.fulfilled, 1);
  assert.equal(s.orders.active.length, 0, 'the order is removed once served');
  assert.equal(s.coins, coins + 10);
  assert.equal(s.reputation, 1);
  assert.equal(s.counters.byType.washedPeach, 1);
  assert.equal(s.counters.fruitOrders, 1);
});

test('a counter buffers an unwanted item and serves it when an order arrives', () => {
  const { level, s, fx } = makeWorldWithFx();
  placeObject(s, level, 'counter', 10, 5, 0, { free: true, silent: true });
  placeBelt(s, level, 9, 5, 0, { free: true });
  beltItem(s, 9, 5, { type: 'washedPeach', progress: 0, fresh: null, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });

  run(s, level, 10, fx);
  assert.equal(s.orders.active.length, 0);
  assert.equal(s.counters.fulfilled, 0);
  assert.equal(s.objects[0].inputs[0].buf.length, 1, 'the cup waits in the counter buffer');
  assert.ok(fx.calls.toasts.some(t => t.title === 'No order wants this'));

  s.orders.active.push(makeOrder({ reward: 12 }));
  run(s, level, 1, fx);
  assert.equal(s.counters.fulfilled, 1, 'the buffered cup matches the new order');
  assert.equal(s.objects[0].inputs[0].buf.length, 0);
  assert.equal(s.orders.active.length, 0);
});

test('a tub melts when freshness runs out, then clears after the melt timer', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 5, 5, 0, { free: true });
  beltItem(s, 5, 5, { type: 'tub', progress: 0, fresh: 1, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });

  run(s, level, 1);
  const belt = beltAt(s, 5, 5);
  assert.equal(belt.item.type, 'melted');
  assert.equal(belt.item.fresh, null);
  assert.equal(belt.item.melt, SIM.meltAutoDiscardTicks);
  assert.equal(s.counters.melted, 1);

  run(s, level, SIM.meltAutoDiscardTicks - 1);
  assert.equal(beltAt(s, 5, 5).item?.type, 'melted', 'melted mix is still clearing');

  run(s, level, 1);
  assert.equal(beltAt(s, 5, 5).item, null, 'melted mix clears itself');
  assert.equal(s.counters.itemsDiscarded, 1);
});

test('a tub warns before it melts', () => {
  const { level, s, fx } = makeWorldWithFx();
  placeBelt(s, level, 5, 5, 0, { free: true });
  beltItem(s, 5, 5, { type: 'tub', progress: 0, fresh: SIM.coldWarnTicks + 1, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });

  run(s, level, 1, fx);
  const item = beltAt(s, 5, 5).item;
  assert.equal(item.type, 'tub');
  assert.equal(item.warned, true);
  assert.ok(fx.calls.sfx.includes('melt'));
});

test('a freezer refreezes melted mix with reduced freshness', () => {
  const { level, s } = makeWorld();
  const placed = placeObject(s, level, 'freezer', 6, 5, 0, { free: true, silent: true });
  placeBelt(s, level, 8, 5, 0, { free: true });
  placeBelt(s, level, 8, 6, 0, { free: true });
  placed.object.inputs[0].buf.push({ type: 'melted', fresh: null, melt: null, refreezeCount: 0 });

  run(s, level, 41);
  const tub = beltAt(s, 8, 5).item;
  assert.equal(tub?.type, 'tub');
  assert.equal(tub.refreezeCount, 1);
  assert.equal(tub.fresh, SIM.coldFreshTicks - SIM.refreezeFreshnessLoss);
});

test('melted mix at the refreeze limit cannot enter a freezer again', () => {
  const { level, s } = makeWorld();
  placeObject(s, level, 'freezer', 6, 5, 0, { free: true, silent: true });
  placeBelt(s, level, 5, 5, 0, { free: true });
  beltItem(s, 5, 5, { type: 'melted', progress: 0, fresh: null, melt: null, refreezeCount: SIM.maxRefreezeCycles, blocked: false, blockedReason: '', warned: false });

  run(s, level, 10);
  const item = beltAt(s, 5, 5).item;
  assert.equal(item.blocked, true);
  assert.match(item.blockedReason, /refreeze limit/);
});

test('the helping hand grants coins and an errand only once', () => {
  const { level, s, fx } = makeWorldWithFx();
  s.coins = 0;
  s.orders.errand = null;

  run(s, level, 10, fx);
  assert.equal(s.coins, SIM.recoveryGrant);
  assert.equal(s.trackers.recoveryUsed, true);
  assert.ok(s.orders.errand, 'the market errand becomes available');
  assert.ok(fx.calls.toasts.some(t => t.title === 'A helping hand'));

  run(s, level, 10, fx);
  assert.equal(s.coins, SIM.recoveryGrant, 'the grant does not repeat');
});

test('completing the primary objective fires once and records earned optionals', () => {
  const { level, s, fx } = makeWorldWithFx({
    objective: { kind: 'orders', count: 1, byType: { washedPeach: 1 }, text: 'Serve one cup' },
    optional: [
      { id: 'noMelt', label: 'No tub melts', kind: 'noMelt' },
      { id: 'noSell', label: 'Never sell', kind: 'noSell' },
    ],
  });
  s.counters.fulfilled = 1;
  s.counters.byType.washedPeach = 1;

  run(s, level, 1, fx);
  assert.equal(s.trackers.completed, true);
  assert.equal(s.levelDone, true);
  assert.equal(fx.calls.completions, 1);
  assert.deepEqual(s.trackers.optionalEarned.sort(), ['noMelt', 'noSell']);

  run(s, level, 5, fx);
  assert.equal(fx.calls.completions, 1, 'completion only fires once');
});

test('a paused simulation does not advance', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 5, 5, 0, { free: true });
  beltItem(s, 5, 5, { type: 'peach', progress: 0, fresh: null, melt: null, refreezeCount: 0, blocked: false, blockedReason: '', warned: false });
  s.paused = true;

  run(s, level, 20);
  assert.equal(beltAt(s, 5, 5).item.progress, 0);
  assert.equal(s.trackers.elapsedTicks, 0);
});

test('idle machines build a waiting streak and clear it when work starts', () => {
  const { level, s } = makeWorld();
  const washer = placeObject(s, level, 'washer', 6, 5, 0, { free: true, silent: true }).object;

  run(s, level, 5);
  assert.equal(washer.state, 'idle');
  assert.equal(washer.idleStreak, 5);

  washer.inputs[0].buf.push({ type: 'peach', fresh: null, melt: null, refreezeCount: 0 });
  run(s, level, 1);
  assert.equal(washer.state, 'working');
  assert.equal(washer.idleStreak, 0);
});

function makeWorldWithFx(overrides = {}) {
  const world = makeWorld(overrides);
  return { ...world, fx: fxSpy() };
}
