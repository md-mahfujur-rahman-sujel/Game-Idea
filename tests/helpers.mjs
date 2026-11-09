// Shared fixtures for the Node test suite. Everything here runs without a DOM,
// WebGL or storage, because the core simulation is deliberately platform-free.

import { createLevelState } from '../src/core/state.js';
import { step } from '../src/core/sim.js';

export const TEST_FIELD = { x0: 0, y0: 0, x1: 19, y1: 14, blocked: [] };

export function testLevel(overrides = {}) {
  return {
    id: 'test',
    num: 'X',
    name: 'Test level',
    chapter: 'Test chapter',
    gridW: 20,
    gridH: 15,
    ...TEST_FIELD,
    startingCoins: 500,
    startingReputation: 0,
    creamCap: 12,
    expiryRep: 0,
    available: [
      'orchard', 'teaPatch', 'waterPump', 'dairyCrate',
      'washer', 'press', 'brewer', 'mixer', 'freezer', 'belt',
    ],
    preplaced: [],
    preBelts: [],
    objective: { kind: 'orders', count: 999, text: 'Never finishes' },
    optional: [],
    orderPool: [],
    tutorialSteps: [],
    ...overrides,
  };
}

export function makeWorld(overrides = {}) {
  const level = testLevel(overrides);
  const s = createLevelState(level);
  // Keep the automatic customer spawner quiet. Tests that care about orders
  // push them directly into s.orders.active.
  s.orders.spawnTimer = 1_000_000;
  return { level, s };
}

export function run(s, level, ticks, fx = noopFx()) {
  for (let i = 0; i < ticks; i++) step(s, level, fx);
}

export function noopFx() {
  return {
    toast() {},
    sfx() {},
    onSave() {},
    onComplete() {},
  };
}

export function fxSpy() {
  const calls = { toasts: [], sfx: [], saves: 0, completions: 0 };
  return {
    calls,
    toast(title, message, tone) { calls.toasts.push({ title, message, tone }); },
    sfx(name) { calls.sfx.push(name); },
    onSave() { calls.saves++; },
    onComplete() { calls.completions++; },
  };
}

export function makeOrder(overrides = {}) {
  return {
    uid: 'test-order',
    templateId: 't1',
    items: [{ type: 'washedPeach', qty: 1, need: 1 }],
    reward: 10,
    rep: 1,
    patienceMax: 120,
    remaining: 1200,
    createdAt: 0,
    errand: false,
    ...overrides,
  };
}

// Minimal Web Storage stand-in. SaveStore only needs these five members.
export function memoryStorage() {
  const map = new Map();
  return {
    _map: map,
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    clear() { map.clear(); },
  };
}
