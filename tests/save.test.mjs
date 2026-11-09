import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS, SAVE_VERSION, SaveStore, freshDoc, migrate, validateDoc,
} from '../src/core/save.js';
import { memoryStorage } from './helpers.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = 'lbw.save.v1';
const BACKUP = 'lbw.save.backup.v1';
const DAILY = 'lbw.save.daily.v1';

async function localStore() {
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const store = new SaveStore();
  await store.init();
  return { store, storage };
}

function datedDoc(updatedAt, music = DEFAULT_SETTINGS.music) {
  const doc = freshDoc();
  doc.updatedAt = updatedAt;
  doc.profile.settings.music = music;
  return doc;
}

test('validateDoc accepts the current shape and rejects malformed saves', () => {
  const doc = freshDoc();
  assert.equal(validateDoc(doc), true);
  assert.equal(validateDoc(null), false);
  assert.equal(validateDoc('save'), false);
  assert.equal(validateDoc({ ...doc, version: 0 }), false);
  assert.equal(validateDoc({ ...doc, version: SAVE_VERSION + 1 }), false);
  assert.equal(validateDoc({ ...doc, version: '1' }), false);
  assert.equal(validateDoc({ ...doc, updatedAt: -1 }), false);
  assert.equal(validateDoc({ ...doc, updatedAt: 'soon' }), false);
  assert.equal(validateDoc({ ...doc, profile: null }), false);
  assert.equal(validateDoc({ ...doc, profile: { unlocked: 'tutorial' } }), false);
  assert.equal(validateDoc({ ...doc, profile: { unlocked: ['tutorial', 5] } }), false);

  doc.level = { levelId: 'tutorial', state: {} };
  assert.equal(validateDoc(doc), true);
  assert.equal(validateDoc({ ...doc, level: { levelId: 'tutorial' } }), false);
  assert.equal(validateDoc({ ...doc, level: { levelId: 5, state: {} } }), false);
  assert.equal(validateDoc({ ...doc, level: { levelId: 'tutorial', state: 'nope' } }), false);
});

test('migrate is an identity function for the current version', () => {
  const doc = freshDoc();
  assert.equal(migrate(doc), doc);
});

test('SaveStore falls back to localStorage when IndexedDB is missing', async () => {
  const { store } = await localStore();
  assert.equal(store.mode, 'local');
  assert.equal(store.lastError, 'no-idb');
});

test('a save survives a round trip through local storage', async () => {
  const { store } = await localStore();
  const doc = datedDoc(1000, 0.25);

  await store.save(doc);
  const loaded = await store.load();

  assert.equal(loaded.status, 'mirror');
  assert.equal(loaded.restoredFrom, 'current');
  assert.equal(loaded.storage, 'local');
  assert.equal(loaded.doc.updatedAt, 1000);
  assert.equal(loaded.doc.profile.settings.music, 0.25);
});

test('a corrupt current save falls back to the previous-good backup', async () => {
  const { store, storage } = await localStore();
  await store.save(datedDoc(1000, 0.1));
  await store.save(datedDoc(2000, 0.2));

  storage.setItem(KEY, '{not valid json');
  const loaded = await store.load();

  assert.equal(loaded.status, 'backup');
  assert.equal(loaded.restoredFrom, 'backup');
  assert.equal(loaded.doc.updatedAt, 1000);
  assert.equal(loaded.doc.profile.settings.music, 0.1);
});

test('a daily copy rescues a save when current and backup are damaged', async () => {
  const { store, storage } = await localStore();
  await store.save(datedDoc(1000, 0.1));
  await store.save(datedDoc(2000, 0.2));
  await store.save(datedDoc(3000, 0.3));

  storage.setItem(KEY, '{broken');
  storage.setItem(BACKUP, '[broken');
  const loaded = await store.load();

  assert.equal(loaded.status, 'daily');
  assert.equal(loaded.restoredFrom, 'daily');
  assert.equal(loaded.doc.updatedAt, 1000);
});

test('the daily copy is refreshed after a full day', async () => {
  const { store, storage } = await localStore();
  const first = datedDoc(1000, 0.1);
  await store.save(first);
  await store.save(datedDoc(2000, 0.2));
  await store.save(datedDoc(3000, 0.3));

  const fresh = datedDoc(first.updatedAt + DAY_MS + 1, 0.9);
  await store.save(fresh);

  storage.setItem(KEY, '{broken');
  storage.setItem(BACKUP, '[broken');
  const loaded = await store.load();

  assert.equal(loaded.status, 'daily');
  assert.equal(loaded.doc.updatedAt, fresh.updatedAt);
  assert.equal(loaded.doc.profile.settings.music, 0.9);
});

test('treating every copy as damaged reports the problem instead of throwing', async () => {
  const { store, storage } = await localStore();
  storage.setItem(KEY, '{broken');
  storage.setItem(BACKUP, '"not a document"');
  storage.setItem(DAILY, JSON.stringify({ version: SAVE_VERSION + 1 }));

  const loaded = await store.load();
  assert.equal(loaded.status, 'corrupt');
  assert.equal(loaded.damaged.length, 3);
  assert.equal(loaded.damaged.find(c => c.key === 'current').parseError, true);
});

test('an empty store reports empty and clear removes every slot', async () => {
  const { store, storage } = await localStore();
  assert.equal((await store.load()).status, 'empty');

  await store.save(datedDoc(1000));
  assert.ok(storage.getItem(KEY));
  assert.ok(storage.getItem(DAILY));

  await store.clear();
  assert.equal(storage.getItem(KEY), null);
  assert.equal(storage.getItem(BACKUP), null);
  assert.equal(storage.getItem(DAILY), null);
  assert.equal((await store.load()).status, 'empty');
});
