import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateOptional, evaluatePrimary, primaryProgress,
} from '../src/core/objectives.js';
import { makeWorld } from './helpers.mjs';

test('primary objectives require the order count, named items and purees', () => {
  const { s } = makeWorld();
  const level = {
    objective: { kind: 'orders', count: 2, byType: { washedPeach: 1, tub: 1 }, minBase: 1 },
  };

  assert.equal(evaluatePrimary(level, s), false);

  s.counters.fulfilled = 2;
  s.counters.byType = { washedPeach: 1, tub: 1 };
  assert.equal(evaluatePrimary(level, s), false, 'minBase is still unmet');

  s.counters.baseOrders = 1;
  assert.equal(evaluatePrimary(level, s), true);
});

test('a level without a primary objective never completes by accident', () => {
  assert.equal(evaluatePrimary({}, makeWorld().s), false);
  assert.equal(evaluatePrimary({ objective: { count: 0 } }, makeWorld().s), true);
});

test('optional objectives use their documented thresholds', () => {
  const { s } = makeWorld();
  const checks = {
    noCustomerLeft: { id: 'a', kind: 'noCustomerLeft' },
    underTime: { id: 'b', kind: 'underTime', seconds: 240 },
    maxBelts: { id: 'c', kind: 'maxBelts', n: 12 },
    noBlock30: { id: 'd', kind: 'noBlock30' },
    noRepLoss: { id: 'e', kind: 'noRepLoss' },
    noMelt: { id: 'f', kind: 'noMelt' },
    noSell: { id: 'g', kind: 'noSell' },
  };

  for (const [id, obj] of Object.entries(checks)) {
    assert.equal(evaluateOptional(obj, s), true, `${id} should pass on a fresh state`);
  }

  s.counters.customerLeft = 1;
  assert.equal(evaluateOptional(checks.noCustomerLeft, s), false);

  s.trackers.elapsedTicks = 2400;
  assert.equal(evaluateOptional(checks.underTime, s), true, 'exactly on time still counts');
  s.trackers.elapsedTicks = 2401;
  assert.equal(evaluateOptional(checks.underTime, s), false);

  s.counters.beltsPlaced = 12;
  assert.equal(evaluateOptional(checks.maxBelts, s), true);
  s.counters.beltsPlaced = 13;
  assert.equal(evaluateOptional(checks.maxBelts, s), false);

  s.trackers.longestBlock = 299;
  assert.equal(evaluateOptional(checks.noBlock30, s), true);
  s.trackers.longestBlock = 300;
  assert.equal(evaluateOptional(checks.noBlock30, s), false);

  s.counters.repLoss = 1;
  assert.equal(evaluateOptional(checks.noRepLoss, s), false);

  s.counters.melted = 1;
  assert.equal(evaluateOptional(checks.noMelt, s), false);

  s.counters.soldMachines = 1;
  assert.equal(evaluateOptional(checks.noSell, s), false);

  assert.equal(evaluateOptional({ id: 'x', kind: 'unknown' }, s), false);
});

test('primary progress clamps to the target and labels item types', () => {
  const { s } = makeWorld();
  s.counters.fulfilled = 9;
  s.counters.byType = { washedPeach: 9, tub: 1 };

  const withTypes = primaryProgress({
    objective: { count: 6, byType: { washedPeach: 3, tub: 2 } },
  }, s);
  assert.equal(withTypes.done, 6);
  assert.equal(withTypes.total, 6);
  assert.match(withTypes.extra, /peach cup 3\/3/);
  assert.match(withTypes.extra, /ice cream 1\/2/);

  const withBase = primaryProgress({
    objective: { count: 5, minBase: 2 },
  }, { ...s, counters: { ...s.counters, baseOrders: 1 } });
  assert.equal(withBase.extra, 'puree 1/2');
});
