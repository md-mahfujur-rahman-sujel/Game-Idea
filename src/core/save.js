// One versioned save document with a previous-good slot and daily recovery copy.
// IndexedDB is primary; localStorage is the fallback and keeps a separate daily copy.

export const SAVE_VERSION = 1;
const DB_NAME = 'little-batch-works';
const STORE = 'saves';
const KEY = 'current';
const BACKUP = 'backup';
const DAILY = 'daily';
const LS_KEYS = {
  [KEY]: 'lbw.save.v1',
  [BACKUP]: 'lbw.save.backup.v1',
  [DAILY]: 'lbw.save.daily.v1',
};
const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY = { [KEY]: 3, [BACKUP]: 2, [DAILY]: 1 };
const STORAGE_PRIORITY = { idb: 2, local: 1 };

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb-open-failed'));
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('idb-write-aborted'));
  });
}

function idbDel(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class SaveStore {
  constructor() {
    this.db = null;
    this.mode = 'idb';
    this.lastError = null;
  }

  async init() {
    try {
      this.db = await openDB();
      this.mode = 'idb';
    } catch (err) {
      this.db = null;
      this.mode = 'local';
      this.lastError = String(err && err.message || err);
    }
  }

  async _copies(key) {
    const copies = [];
    if (this.db) {
      try {
        const value = await idbGet(this.db, key);
        if (value !== undefined) copies.push({ key, storage: 'idb', value });
      } catch (err) {
        this.lastError = String(err && err.message || err);
      }
    }
    try {
      const raw = localStorage.getItem(LS_KEYS[key]);
      if (raw) {
        try { copies.push({ key, storage: 'local', value: JSON.parse(raw) }); }
        catch { copies.push({ key, storage: 'local', raw, parseError: true }); }
      }
    } catch (err) {
      this.lastError = String(err && err.message || err);
    }
    return copies;
  }

  async _write(key, value, mirror = false) {
    let stored = false;
    if (this.db) {
      try { await idbSet(this.db, key, value); stored = true; }
      catch (err) { this.lastError = String(err && err.message || err); }
    }
    if (!stored || mirror) {
      try {
        localStorage.setItem(LS_KEYS[key], JSON.stringify(value));
        stored = true;
      } catch (err) {
        this.lastError = String(err && err.message || err);
      }
    }
    if (!stored) throw new Error(this.lastError || 'save-storage-unavailable');
    return true;
  }

  async save(doc) {
    const currentCopies = await this._copies(KEY);
    const previous = currentCopies
      .filter(copy => validateDoc(copy.value))
      .sort((a, b) => b.value.updatedAt - a.value.updatedAt)[0];
    if (previous && previous.value.updatedAt < doc.updatedAt) {
      try { await this._write(BACKUP, previous.value, true); }
      catch { /* Keep the current save even if the backup medium is full. */ }
    }

    await this._write(KEY, doc);

    const dailyCopies = await this._copies(DAILY);
    const daily = dailyCopies
      .filter(copy => validateDoc(copy.value))
      .sort((a, b) => b.value.updatedAt - a.value.updatedAt)[0];
    if (!daily || doc.updatedAt - daily.value.updatedAt >= DAY_MS) {
      try { await this._write(DAILY, doc, true); }
      catch { /* Current and previous-good saves remain usable. */ }
    }
    return true;
  }

  async load() {
    const copies = [];
    for (const key of [KEY, BACKUP, DAILY]) copies.push(...await this._copies(key));
    const candidates = copies
      .filter(copy => validateDoc(copy.value))
      .sort((a, b) => (b.value.updatedAt - a.value.updatedAt)
        || (PRIORITY[b.key] - PRIORITY[a.key])
        || (STORAGE_PRIORITY[b.storage] - STORAGE_PRIORITY[a.storage]));
    if (candidates.length) {
      const best = candidates[0];
      const status = best.key === KEY
        ? best.storage === 'idb' ? 'ok' : 'mirror'
        : best.key;
      return { status, doc: migrate(best.value), restoredFrom: best.key, storage: best.storage };
    }
    if (copies.length) {
      return {
        status: 'corrupt',
        damaged: copies.map(copy => ({ key: copy.key, storage: copy.storage, value: copy.value, raw: copy.raw, parseError: !!copy.parseError })),
      };
    }
    return { status: 'empty' };
  }

  downloadDamaged(copies = []) {
    if (!copies.length || typeof document === 'undefined' || typeof Blob === 'undefined') return false;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), damagedSaves: copies }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `little-batch-works-damaged-save-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async clear() {
    if (this.db) {
      await Promise.allSettled([KEY, BACKUP, DAILY].map(key => idbDel(this.db, key)));
    }
    try {
      for (const key of Object.values(LS_KEYS)) localStorage.removeItem(key);
    } catch { /* Ignore unavailable local storage. */ }
  }
}

export function validateDoc(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (typeof doc.version !== 'number' || doc.version < 1 || doc.version > SAVE_VERSION) return false;
  if (!doc.profile || typeof doc.profile !== 'object') return false;
  if (!Array.isArray(doc.profile.unlocked) || !doc.profile.unlocked.every(id => typeof id === 'string')) return false;
  if (doc.updatedAt != null && (!Number.isFinite(doc.updatedAt) || doc.updatedAt < 0)) return false;
  if (doc.level != null) {
    if (typeof doc.level !== 'object' || typeof doc.level.levelId !== 'string') return false;
    if (!doc.level.state || typeof doc.level.state !== 'object') return false;
  }
  return true;
}

// One entry per version bump: MIGRATIONS[n] upgrades a version-n document to n + 1.
// Add the step here, then raise SAVE_VERSION. Older saves are upgraded in order on load,
// so a bump never makes an existing save unreadable.
const MIGRATIONS = {};

export function migrate(doc) {
  let out = doc;
  while (out.version < SAVE_VERSION) {
    const step = MIGRATIONS[out.version];
    if (!step) break;
    out = { ...step(out), version: out.version + 1 };
  }
  return out;
}

export const DEFAULT_SETTINGS = {
  music: 0.5,
  sfx: 0.7,
  muted: false,
  reducedMotion: false,
  gridOverlay: false,
  statusOverlay: true,
  hints: true,
};

export function freshDoc() {
  return {
    version: SAVE_VERSION,
    updatedAt: Date.now(),
    profile: {
      unlocked: ['tutorial'],
      completed: {},
      settings: { ...DEFAULT_SETTINGS },
      createdAt: Date.now(),
    },
    level: null,
  };
}
