import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beltAt, beltHasReceiver, buyCream, contentsOf, createLevelState, machineTiming, objectAt,
  placeBelt, placeObject, refundFor, sanitizeState, sellBelt, sellObject,
  stallReport, upgradeCooling, upgradeSpeed,
} from '../src/core/state.js';
import { LEVELS, LEVEL_BY_ID } from '../src/data/levels.js';
import { SIM } from '../src/data/buildings.js';
import { makeWorld } from './helpers.mjs';

test('a new level starts with its preplaced pieces and fixed belts', () => {
  const level = LEVEL_BY_ID.level2;
  const s = createLevelState(level);

  assert.equal(s.coins, level.startingCoins);
  for (const p of level.preplaced) {
    const o = s.objects.find(x => x.type === p.type && x.x === p.x && x.y === p.y);
    assert.ok(o, `missing preplaced ${p.type}`);
    assert.equal(o.fixed, true);
  }
  for (const b of level.preBelts) {
    assert.ok(beltAt(s, b.x, b.y), `missing fixed belt at ${b.x},${b.y}`);
    assert.equal(beltAt(s, b.x, b.y).preplaced, true);
  }
});

test('placement spends coins, enforces the map and blocks occupied tiles', () => {
  const { level, s } = makeWorld();
  const before = s.coins;
  const placed = placeObject(s, level, 'washer', 5, 5);
  assert.equal(placed.ok, true);
  assert.equal(s.coins, before - 45);
  assert.equal(objectAt(s, 5, 5)?.type, 'washer');

  assert.equal(placeObject(s, level, 'press', 5, 5).code, 'occupied');
  assert.equal(placeObject(s, level, 'orchard', 19, 0).code, 'bounds');

  const poor = makeWorld({ startingCoins: 10 });
  assert.equal(placeObject(poor.s, poor.level, 'washer', 5, 5).code, 'coins');
});

test('free placement does not spend coins and is marked fixed', () => {
  const { level, s } = makeWorld();
  const before = s.coins;
  const placed = placeObject(s, level, 'counter', 10, 8, 0, { free: true });
  assert.equal(placed.ok, true);
  assert.equal(s.coins, before);
  assert.equal(placed.object.fixed, true);
});

test('a building cannot sit on a source output port', () => {
  const { level, s } = makeWorld();
  placeObject(s, level, 'orchard', 3, 4, 0, { free: true, silent: true });

  const result = placeObject(s, level, 'washer', 3, 6);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'port');
  assert.match(result.reason, /drops its output here/);

  // A belt is the one thing that is allowed on a port tile.
  assert.equal(placeBelt(s, level, 3, 6, 0).ok, true);
});

test('belts cost coins, count toward the optional limit, and refund on sale', () => {
  const { level, s } = makeWorld();
  const before = s.coins;
  assert.equal(placeBelt(s, level, 4, 4, 0).ok, true);
  assert.equal(s.coins, before - 4);
  assert.equal(s.counters.beltsPlaced, 1);
  assert.equal(placeBelt(s, level, 4, 4, 0).ok, false, 'a tile only holds one belt');

  beltAt(s, 4, 4).item = { type: 'peach' };
  const sold = sellBelt(s, 4, 4);
  assert.equal(sold.ok, true);
  assert.equal(sold.refund, refundFor('belt'));
  assert.equal(s.coins, before - 4 + refundFor('belt'));
  assert.equal(s.counters.beltsPlaced, 0);
  assert.equal(s.counters.itemsDiscarded, 1);
  assert.equal(beltAt(s, 4, 4), null);
});

test('fixed pieces cannot be sold', () => {
  const level = LEVEL_BY_ID.tutorial;
  const s = createLevelState(level);
  const counter = s.objects.find(o => o.type === 'counter');
  const result = sellObject(s, level, counter.id);
  assert.equal(result.ok, false);
  assert.match(result.reason, /fixed/i);
});

test('selling an object refunds part of its cost and counts lost contents', () => {
  const { level, s } = makeWorld();
  const placed = placeObject(s, level, 'washer', 5, 5, 0, { silent: true });
  placed.object.inputs[0].buf.push({ type: 'peach' });
  placed.object.output.push({ type: 'washedPeach' });
  const before = s.coins;

  const result = sellObject(s, level, placed.object.id);
  assert.equal(result.ok, true);
  assert.equal(result.refund, refundFor('washer'));
  assert.equal(result.lost, 2);
  assert.equal(s.coins, before + result.refund);
  assert.equal(s.counters.itemsDiscarded, 2);
  assert.equal(s.counters.soldMachines, 1);
  assert.equal(objectAt(s, 5, 5), null);

  const source = placeObject(s, level, 'orchard', 10, 10, 0, { silent: true });
  sellObject(s, level, source.object.id);
  assert.equal(s.counters.soldMachines, 1, 'selling a source does not count as selling a machine');
});

test('fixed prebuilt belts cannot be sold', () => {
  const level = LEVEL_BY_ID.level2;
  const s = createLevelState(level);
  const b = level.preBelts[0];
  const result = sellBelt(s, b.x, b.y);
  assert.equal(result.ok, false);
  assert.match(result.reason, /fixed/i);
});

test('buying cream spends coins, respects the cap and fills the crate lane', () => {
  const { level, s } = makeWorld({ creamCap: 2 });
  const crate = placeObject(s, level, 'dairyCrate', 5, 5, 0, { silent: true }).object;
  const before = s.coins;

  assert.equal(buyCream(s, level, crate.id).ok, true);
  assert.equal(s.coins, before - SIM.creamPrice);
  assert.equal(s.creamBought, 1);
  assert.equal(s.counters.creamPurchased, 1);
  assert.deepEqual(crate.lanes[0].buf.map(x => x.type), ['cream']);

  assert.equal(buyCream(s, level, crate.id).ok, true);
  assert.equal(buyCream(s, level, crate.id).reason, 'Cream cap reached (2)');
  assert.equal(s.creamBought, 2);
});

test('cream cannot be bought when the crate lane is full or there is no crate', () => {
  const { level, s } = makeWorld();
  assert.equal(buyCream(s, level, 999).ok, false);

  const crate = placeObject(s, level, 'dairyCrate', 5, 5, 0, { silent: true }).object;
  crate.lanes[0].buf.push({ type: 'cream' }, { type: 'cream' });
  assert.equal(buyCream(s, level, crate.id).reason, 'Crate output is full');
});

test('speed upgrades only apply to machines and stop at the cap', () => {
  const { level, s } = makeWorld();
  const counter = placeObject(s, level, 'counter', 10, 8, 0, { free: true, silent: true }).object;
  assert.equal(upgradeSpeed(s, counter.id).ok, false);
  assert.equal(upgradeSpeed(s, 12345).ok, false);

  const washer = placeObject(s, level, 'washer', 5, 5, 0, { silent: true }).object;
  const before = s.coins;
  assert.equal(upgradeSpeed(s, washer.id).ok, true);
  assert.equal(washer.speedLvl, 1);
  assert.equal(s.coins, before - 40);
  assert.equal(upgradeSpeed(s, washer.id).ok, true);
  assert.equal(washer.speedLvl, 2);
  assert.equal(upgradeSpeed(s, washer.id).reason, 'Speed is fully upgraded');
});

test('cooling upgrades only apply to a freezer and raise its output cap', () => {
  const { level, s } = makeWorld();
  const washer = placeObject(s, level, 'washer', 5, 5, 0, { silent: true }).object;
  assert.equal(upgradeCooling(s, washer.id).ok, false);

  const freezer = placeObject(s, level, 'freezer', 8, 5, 0, { silent: true }).object;
  const before = s.coins;
  assert.equal(upgradeCooling(s, freezer.id).ok, true);
  assert.equal(freezer.coolingLvl, 1);
  assert.equal(freezer.outCap, 8);
  assert.equal(s.coins, before - 60);
  assert.equal(upgradeCooling(s, freezer.id).reason, 'Cooling is fully upgraded');
});

test('machine timing follows the 20% speed curve', () => {
  assert.equal(machineTiming({ speedLvl: 0 }, 30), 30);
  assert.equal(machineTiming({ speedLvl: 1 }, 30), 24);
  assert.equal(machineTiming({ speedLvl: 2 }, 30), 19);
  assert.equal(machineTiming({ speedLvl: 9 }, 1), 1, 'never drops below one tick');
});

test('stall report names a blocked belt and the queue behind it', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 4, 5, 0, { free: true });
  placeBelt(s, level, 5, 5, 0, { free: true });
  beltAt(s, 5, 5).item = { type: 'peach', progress: 1, blocked: true, blockedReason: 'No belt or machine ahead' };

  const report = stallReport(s, { kind: 'belt', x: 5, y: 5 });
  assert.equal(report.tone, 'blocked');
  assert.deepEqual(report.tiles, [{ x: 4, y: 5 }, { x: 5, y: 5 }]);
  assert.match(report.note, /1 belt tile behind/);
});

test('stall report points a starved machine at a supplier', () => {
  const { level, s } = makeWorld();
  const washer = placeObject(s, level, 'washer', 6, 5, 0, { free: true, silent: true }).object;

  const report = stallReport(s, { kind: 'object', id: washer.id });
  assert.equal(report.tone, 'starved');
  assert.equal(report.note, 'This socket is empty.');
  assert.deepEqual(report.jump, { kind: 'build', building: 'orchard', item: 'peach', label: 'Orchard' });
});

test('stall report flags a counter holding unwanted stock', () => {
  const { level, s } = makeWorld();
  const counter = placeObject(s, level, 'counter', 10, 5, 0, { free: true, silent: true }).object;
  counter.inputs[0].buf.push(
    { type: 'washedPeach', fresh: null, melt: null, refreezeCount: 0 },
    { type: 'washedPeach', fresh: null, melt: null, refreezeCount: 0 },
  );

  const report = stallReport(s, { kind: 'object', id: counter.id });
  assert.equal(report.tone, 'blocked');
  assert.match(report.note, /No belt feeds this counter yet/);

  counter.inputs[0].buf.length = 0;
  assert.equal(stallReport(s, { kind: 'object', id: counter.id }).tone, '');
});

test('a belt only reports a receiver when its leading edge actually connects', () => {
  const { level, s } = makeWorld();

  // Nothing ahead.
  placeBelt(s, level, 4, 5, 0, { free: true });
  assert.equal(beltHasReceiver(s, beltAt(s, 4, 5)), false);

  // A belt ahead accepts the handoff.
  placeBelt(s, level, 5, 5, 0, { free: true });
  assert.equal(beltHasReceiver(s, beltAt(s, 4, 5)), true);
  assert.equal(beltHasReceiver(s, beltAt(s, 5, 5)), false, 'the last belt still points at open ground');

  // Two belts facing each other cannot hand off.
  placeBelt(s, level, 6, 5, 2, { free: true });
  assert.equal(beltHasReceiver(s, beltAt(s, 5, 5)), false);
  assert.equal(beltHasReceiver(s, beltAt(s, 6, 5)), false);

  // A machine only accepts on a side with an input socket.
  const washer = placeObject(s, level, 'washer', 10, 5, 0, { free: true, silent: true }).object;
  placeBelt(s, level, 9, 5, 0, { free: true });
  placeBelt(s, level, 10, 4, 1, { free: true });
  assert.equal(beltHasReceiver(s, beltAt(s, 9, 5)), true, 'washer input is on its west side');
  assert.equal(beltHasReceiver(s, beltAt(s, 10, 4)), false, 'the north side has no socket');
  assert.equal(washer.inputs.length, 1);

  // A counter is an intake from any edge, so the scene should not warn there.
  placeObject(s, level, 'counter', 10, 9, 0, { free: true, silent: true });
  placeBelt(s, level, 9, 9, 0, { free: true });
  assert.equal(beltHasReceiver(s, beltAt(s, 9, 9)), true);
});

test('every authored level is fully repaired from an empty save', () => {
  for (const level of LEVELS) {
    const repaired = sanitizeState({}, level);
    for (const p of level.preplaced) {
      const o = repaired.objects.find(x => x.type === p.type && x.x === p.x && x.y === p.y);
      assert.ok(o, `${level.id}: missing ${p.type} at ${p.x},${p.y}`);
      assert.equal(o.fixed, true, `${level.id}: ${p.type} should be fixed`);
    }
    for (const b of level.preBelts) {
      assert.ok(beltAt(repaired, b.x, b.y), `${level.id}: missing fixed belt at ${b.x},${b.y}`);
      assert.equal(beltAt(repaired, b.x, b.y).preplaced, true);
    }
  }
});

test('sanitize rejects a non-document and clamps hostile numbers', () => {
  assert.equal(sanitizeState(null, LEVEL_BY_ID.tutorial), null);
  assert.equal(sanitizeState('nope', LEVEL_BY_ID.tutorial), null);

  const level = LEVEL_BY_ID.level1;
  const s = sanitizeState({
    coins: 1e12,
    reputation: -10,
    creamBought: 999,
    nextObjectId: -4,
    trackers: { elapsedTicks: -5, longestBlock: 1e15, optionalEarned: ['ok', 5] },
    counters: { fulfilled: -2, byType: { washedPeach: -1, ghost: 9 } },
  }, level);

  assert.equal(s.coins, 999999);
  assert.equal(s.reputation, level.startingReputation);
  assert.equal(s.creamBought, level.creamCap);
  assert.ok(s.nextObjectId >= 1);
  assert.ok(s.objects.every(o => o.id < s.nextObjectId), 'next id is ahead of every restored object');
  assert.equal(s.trackers.elapsedTicks, 0);
  assert.equal(s.trackers.longestBlock, 1e9);
  assert.deepEqual(s.trackers.optionalEarned, ['ok']);
  assert.equal(s.counters.fulfilled, 0);
  assert.equal(s.counters.byType.washedPeach, 0);
  assert.equal(s.counters.byType.ghost, undefined);
});

test('sanitize drops bad, overlapping and map-breaking objects', () => {
  const level = LEVEL_BY_ID.tutorial;
  const s = sanitizeState({
    objects: [
      { type: 'lava', x: 3, y: 3, id: 1 },
      { type: 'washer', x: 5, y: 5, id: 2, speedLvl: 9 },
      { type: 'press', x: 5, y: 5, id: 3 },
      { type: 'orchard', x: 39, y: 22, id: 4 },
      { type: 'freezer', x: 10, y: 10, id: 5, coolingLvl: 7 },
      { type: 'washer', x: 12, y: 10, id: 2 },
    ],
  }, level);

  assert.equal(s.objects.filter(o => o.type === 'lava').length, 0);
  assert.equal(s.objects.filter(o => o.type === 'press').length, 0, 'overlapping object dropped');
  assert.equal(s.objects.filter(o => o.type === 'orchard' && o.x === 39).length, 0, 'out-of-bounds object dropped');
  const washer = s.objects.find(o => o.type === 'washer' && o.x === 5);
  assert.equal(washer.speedLvl, 2, 'speed level is clamped');
  const freezer = s.objects.find(o => o.type === 'freezer');
  assert.equal(freezer.coolingLvl, 1);
  assert.equal(freezer.outCap, 8);

  const ids = s.objects.map(o => o.id);
  assert.equal(new Set(ids).size, ids.length, 'restored ids are unique');
});

test('sanitize reserves fixed tiles so a corrupt object cannot erase the counter', () => {
  const level = LEVEL_BY_ID.tutorial;
  const counter = level.preplaced.find(p => p.type === 'counter');
  const s = sanitizeState({
    objects: [{ type: 'washer', x: counter.x, y: counter.y, id: 1 }],
  }, level);
  const restored = s.objects.find(o => o.type === 'counter');
  assert.ok(restored, 'the fixed counter is restored');
  assert.equal(s.objects.some(o => o.type === 'washer'), false, 'the blocking washer is dropped');
});

test('sanitize restores belt items safely and keeps the melt warning', () => {
  const level = LEVEL_BY_ID.tutorial;
  const s = sanitizeState({
    belts: [
      { x: 5, y: 5, dir: -3, item: { type: 'tub', fresh: 200, melt: null, refreezeCount: 9, progress: 0.4, blocked: true, blockedReason: 'jam', warned: true } },
      { x: 6, y: 5, dir: 0, item: { type: 'ghost', fresh: 10 } },
      { x: 400, y: 400, dir: 0 },
      { x: 7, y: 8, dir: 0 },
    ],
  }, level);

  const belt = s.belts['5,5'];
  assert.ok(belt);
  assert.equal(belt.dir, 1, 'direction is normalised');
  assert.equal(belt.item.type, 'tub');
  assert.equal(belt.item.progress, 0.4);
  assert.equal(belt.item.refreezeCount, SIM.maxRefreezeCycles);
  assert.equal(belt.item.blocked, true);
  assert.equal(belt.item.blockedReason, 'jam');
  assert.equal(belt.item.warned, true);
  assert.equal(s.belts['6,5'].item, null, 'an unknown item is removed');
  assert.equal(s.belts['400,400'], undefined, 'an off-map belt is dropped');
  assert.equal(s.belts['7,8'], undefined, 'a belt on the fixed counter is dropped');
});

test('sanitize filters impossible orders and keeps the errand', () => {
  const level = makeWorld({
    orderPool: [{ id: 'x', items: [{ type: 'washedPeach', qty: 1 }], reward: 10, rep: 1, patience: 120, gap: 10 }],
  }).level;
  const s = sanitizeState({
    orders: {
      active: [
        { uid: 'a', items: [{ type: 'ghost', qty: 1, need: 1 }], reward: 5, remaining: 10 },
        { uid: 'b', items: [{ type: 'washedPeach', qty: 1, need: 0 }], reward: 5, remaining: 10 },
        { uid: 'c', items: [{ type: 'washedPeach', qty: 2, need: 1 }], reward: 99, rep: 2, patienceMax: 50, remaining: 400 },
      ],
      queueIndex: 999,
      spawnTimer: -5,
      errand: { sent: true, remaining: 42, reward: 6 },
    },
  }, level);

  assert.equal(s.orders.active.length, 1);
  assert.equal(s.orders.active[0].uid, 'c');
  assert.deepEqual(s.orders.active[0].items, [{ type: 'washedPeach', qty: 2, need: 1 }]);
  assert.equal(s.orders.queueIndex, level.orderPool.length);
  assert.equal(s.orders.spawnTimer, 0);
  assert.deepEqual(s.orders.errand, { sent: true, remaining: 42, reward: 6 });
});

test('contentsOf reports source lanes, input sockets and output stock', () => {
  const { level, s } = makeWorld();
  const source = placeObject(s, level, 'orchard', 3, 4, 0, { free: true, silent: true }).object;
  source.lanes[0].buf.push({ type: 'peach' });
  assert.equal(contentsOf(source).length, 1);

  const freezer = placeObject(s, level, 'freezer', 8, 8, 0, { free: true, silent: true }).object;
  freezer.inputs[0].buf.push({ type: 'peachMix' });
  freezer.output.push({ type: 'tub' }, { type: 'tub' });
  assert.equal(contentsOf(freezer).length, 3);
});
