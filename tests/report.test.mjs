import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReport } from '../src/core/report.js';
import { beltAt, placeBelt, placeObject } from '../src/core/state.js';
import { makeWorld } from './helpers.mjs';

function putOnBelt(s, x, y, item) {
  const belt = beltAt(s, x, y);
  assert.ok(belt, `expected a belt at ${x},${y}`);
  belt.item = item;
  return belt;
}

test('an empty workshop reports a calm, complete snapshot', () => {
  const { level, s } = makeWorld();
  const report = buildReport(s, level);

  assert.equal(report.issues.length, 0);
  assert.equal(report.waiting.length, 0);
  assert.equal(report.ordersServed, 0);
  assert.equal(report.totalDelivered, 0);
  assert.equal(report.ordersPerMinute, 0);
  assert.equal(report.cold.nextMeltSeconds, null);
  assert.equal(report.belts.tiles, 0);
  assert.match(report.tip, /first customer arrives/);
});

test('throughput, delivered items and the coin snapshot come from live counters', () => {
  const { level, s } = makeWorld();
  s.trackers.elapsedTicks = 1200;
  s.counters.fulfilled = 6;
  s.counters.byType = { washedPeach: 4, tub: 2, ghost: 10 };
  s.coins = 123;
  s.reputation = 7;

  const report = buildReport(s, level);

  assert.equal(report.ordersServed, 6);
  assert.equal(report.ordersPerMinute, 3);
  assert.equal(report.totalDelivered, 6, 'unknown item ids are ignored');
  assert.deepEqual(report.delivered.map(item => item.type), ['washedPeach', 'tub']);
  assert.equal(report.coins, 123);
  assert.equal(report.reputation, 7);
  assert.equal(report.cold.tubsDelivered, 2);
});

test('a blocked machine is the first issue and carries a jump target', () => {
  const { level, s } = makeWorld();
  const washer = placeObject(s, level, 'washer', 6, 5, 0, { free: true, silent: true }).object;
  washer.state = 'blocked';
  washer.reason = 'Washer output full';
  washer.blockedStreak = 120;
  washer.output.push({ type: 'washedPeach' });

  const report = buildReport(s, level);

  assert.equal(report.machines.blocked, 1);
  assert.equal(report.issues[0].title, 'Washer cannot empty');
  assert.match(report.issues[0].detail, /blocked for 12s/);
  assert.deepEqual(report.issues[0].jump, { kind: 'object', id: washer.id });
});

test('a counter holding unwanted stock is the highest-priority issue', () => {
  const { level, s } = makeWorld();
  const counter = placeObject(s, level, 'counter', 10, 5, 0, { free: true, silent: true }).object;
  counter.inputs[0].buf.push({ type: 'washedPeach', fresh: null, melt: null, refreezeCount: 0 });

  const report = buildReport(s, level);

  assert.match(report.issues[0].title, /Counter is holding Washed Peach/);
  assert.match(report.issues[0].detail, /No waiting order wants this/);
  assert.deepEqual(report.issues[0].jump, { kind: 'object', id: counter.id });
});

test('an order makes the same buffered counter item legitimate', () => {
  const { level, s } = makeWorld();
  const counter = placeObject(s, level, 'counter', 10, 5, 0, { free: true, silent: true }).object;
  counter.inputs[0].buf.push({ type: 'washedPeach', fresh: null, melt: null, refreezeCount: 0 });
  s.orders.active.push({
    uid: 'o1', templateId: 't1',
    items: [{ type: 'washedPeach', qty: 1, need: 1 }],
    reward: 10, rep: 1, patienceMax: 120, remaining: 1200,
    createdAt: 0, errand: false,
  });

  assert.equal(buildReport(s, level).issues.length, 0);
});

test('a jammed source names the full lane and jumps to the building', () => {
  const { level, s } = makeWorld();
  const orchard = placeObject(s, level, 'orchard', 3, 4, 0, { free: true, silent: true }).object;
  const lane = orchard.lanes[0];
  lane.buf = Array.from({ length: lane.buffer }, () => ({ type: lane.item }));

  const report = buildReport(s, level);

  assert.equal(report.issues[0].title, 'Orchard cannot empty');
  assert.match(report.issues[0].detail, /Peach is waiting/);
  assert.deepEqual(report.issues[0].jump, { kind: 'object', id: orchard.id });
});

test('belt jams with the same reason collapse into one actionable row', () => {
  const { level, s } = makeWorld();
  placeBelt(s, level, 4, 5, 0, { free: true });
  placeBelt(s, level, 5, 5, 0, { free: true });
  const blocked = { type: 'peach', progress: 1, blocked: true, blockedReason: 'No belt or machine ahead', fresh: null, melt: null, refreezeCount: 0, warned: false };
  putOnBelt(s, 4, 5, { ...blocked });
  putOnBelt(s, 5, 5, { ...blocked });

  const report = buildReport(s, level);

  assert.equal(report.belts.blocked, 2);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].title, 'Belt jam · No belt or machine ahead');
  assert.match(report.issues[0].detail, /2 belt tiles stuck · first at 4, 5/);
  assert.deepEqual(report.issues[0].jump, { kind: 'belt', x: 4, y: 5 });
});

test('the cold chain reports tubs on belts, the next melt and cream left', () => {
  const { level, s } = makeWorld({ creamCap: 12 });
  placeBelt(s, level, 5, 5, 0, { free: true });
  placeBelt(s, level, 6, 5, 0, { free: true });
  putOnBelt(s, 5, 5, { type: 'tub', fresh: 120, melt: null, refreezeCount: 0, progress: 0, blocked: false, blockedReason: '', warned: false });
  putOnBelt(s, 6, 5, { type: 'melted', fresh: null, melt: 90, refreezeCount: 0, progress: 0, blocked: false, blockedReason: '', warned: false });
  s.counters.byType = { tub: 3 };
  s.counters.melted = 1;
  s.creamBought = 5;

  const report = buildReport(s, level);

  assert.equal(report.cold.tubsDelivered, 3);
  assert.equal(report.cold.melted, 1);
  assert.equal(report.cold.tubsOnBelts, 1);
  assert.equal(report.cold.tubsAtRisk, 1);
  assert.equal(report.cold.nextMeltSeconds, 12);
  assert.equal(report.cold.meltedOnLine, 1);
  assert.equal(report.cold.creamLeft, 7);
  assert.match(report.tip, /under 15 seconds of chill/);
});

test('idle machines that have waited long enough appear in the waiting list', () => {
  const { level, s } = makeWorld();
  const washer = placeObject(s, level, 'washer', 6, 5, 0, { free: true, silent: true }).object;
  washer.reason = 'Waiting for an ingredient';
  washer.idleStreak = 150;

  const report = buildReport(s, level);

  assert.equal(report.machines.idle, 1);
  assert.equal(report.waiting.length, 1);
  assert.equal(report.waiting[0].name, 'Washer');
  assert.equal(report.waiting[0].seconds, 15);
  assert.deepEqual(report.waiting[0].jump, { kind: 'object', id: washer.id });
  assert.match(report.tip, /has been waiting 15s/);
});

test('a machine that just became idle is not reported as waiting yet', () => {
  const { level, s } = makeWorld();
  const washer = placeObject(s, level, 'washer', 6, 5, 0, { free: true, silent: true }).object;
  washer.idleStreak = 29;

  assert.equal(buildReport(s, level).waiting.length, 0);
});

test('the report tolerates a bare state object', () => {
  const report = buildReport({}, { creamCap: 0 });
  assert.equal(report.ordersServed, 0);
  assert.equal(report.issues.length, 0);
  assert.ok(report.tip);
});
