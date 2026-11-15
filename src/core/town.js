// Town progression: uncapped Town Levels, unlock tree, order board, land expansion,
// authored and generated saga chapters, daily goals, and the capped overnight batch.
// Everything is stored on the profile so the save schema stays valid, and nothing here
// touches the deterministic simulation except `townTemplate`, which is a pure function of the
// state it is given.

// Safe-integer boundary keeps saves and generated saga goals exact.
export const MAX_TOWN_LEVEL = Number.MAX_SAFE_INTEGER;
const SAGA_GOALS = {
  fulfilled: { unit: 'orders' },
  baseOrders: { unit: 'puree orders' },
  teaOrders: { unit: 'teas' },
  tubOrders: { unit: 'ice creams' },
  tartOrders: { unit: 'fruit tarts' },
};

// ---------------------------------------------------------------- XP and level

export function xpToNext(level) {
  return level <= 20 ? 40 + 25 * level : 540 + 60 * (level - 20);
}

export function ensureTown(profile) {
  if (!profile) return profile;
  if (!Number.isFinite(profile.townLevel) || profile.townLevel < 1) profile.townLevel = 1;
  profile.townLevel = Math.min(MAX_TOWN_LEVEL, Math.floor(profile.townLevel));
  if (!Number.isFinite(profile.xp) || profile.xp < 0) profile.xp = 0;
  if (!Number.isFinite(profile.permits) || profile.permits < 0) profile.permits = 0;
  if (!Number.isFinite(profile.expansion) || profile.expansion < 0) profile.expansion = 0;
  profile.expansion = Math.min(EXPANSIONS.length - 1, Math.floor(profile.expansion));
  if (!profile.stats || typeof profile.stats !== 'object') profile.stats = {};
  const st = profile.stats;
  for (const k of ['fulfilled', 'items', 'baseOrders', 'teaOrders', 'tubOrders', 'tartOrders']) {
    if (!Number.isFinite(st[k]) || st[k] < 0) st[k] = 0;
  }
  if (!st.byType || typeof st.byType !== 'object') st.byType = {};
  if (!profile.story || typeof profile.story !== 'object') profile.story = { chapter: 0, step: 0 };
  if (!Number.isFinite(profile.story.chapter) || profile.story.chapter < 0) profile.story.chapter = 0;
  profile.story.chapter = Math.min(MAX_SAFE_LEVEL, Math.floor(profile.story.chapter));
  if (!Number.isFinite(profile.story.step) || profile.story.step < 0) profile.story.step = 0;
  const loop = profile.story.activeLoop;
  if (!loop || !Number.isSafeInteger(loop.chapter) || !Number.isSafeInteger(loop.startValue)
    || loop.startValue < 0 || !Object.hasOwn(SAGA_GOALS, loop.stat)) {
    profile.story.activeLoop = null;
  }
  if (!Number.isFinite(profile.landmark) || profile.landmark < 0) profile.landmark = 0;
  if (!Array.isArray(profile.recent)) profile.recent = [];
  return profile;
}

export function orderXp(order) {
  const qty = (order.items || []).reduce((a, it) => a + (it.qty || 0), 0);
  return Math.max(5, Math.round(8 + qty * 4 + (order.reward || 0) / 10));
}

// Adds XP and rolls over levels. Returns the levels gained and what they unlock.
export function addXp(profile, amount) {
  ensureTown(profile);
  const from = profile.townLevel;
  profile.xp += Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
  while (profile.townLevel < MAX_TOWN_LEVEL && profile.xp >= xpToNext(profile.townLevel)) {
    profile.xp -= xpToNext(profile.townLevel);
    profile.townLevel++;
  }
  const unlocked = [];
  let permits = 0;
  for (let lv = from + 1; lv <= profile.townLevel; lv++) {
    for (const u of UNLOCK_NOTES[lv] || []) unlocked.push(u);
    if (PERMIT_LEVELS.includes(lv)) permits++;
  }
  profile.permits += permits;
  return { levelsGained: profile.townLevel - from, level: profile.townLevel, unlocked, permits };
}

// ---------------------------------------------------------------- unlock tree

export const BUILDING_UNLOCK = {
  belt: 1, orchard: 1, washer: 1, press: 2,
  teaPatch: 3, waterPump: 3, brewer: 3,
  dairyCrate: 5, mixer: 5, freezer: 8,
  splitter: 10, merger: 15, wheatField: 18, flourMill: 18, bakery: 20,
};
export const SPEED_UPGRADE_LEVEL = 3;
export const PERMIT_LEVELS = [8, 15, 22, 30, 40];

export const UNLOCK_NOTES = {
  2: ['Press: puree orders'],
  3: ['Tea Patch, Water Pump and Brewer: tea orders', 'Machine speed upgrades'],
  5: ['Dairy Crate and Mixer', 'Order board grows to 4 slots'],
  8: ['Freezer and ice cream orders', 'First land expansion', '1 Expansion Permit'],
  10: ['Splitter: send one line along two routes'],
  12: ['Combo orders: two products in one order'],
  15: ['Merger: combine two compatible lines', '1 Expansion Permit'],
  18: ['Wheat Field and Flour Mill'],
  20: ['Bakery: fruit tart orders'],
  22: ['Second expansion', 'Order board grows to 5 slots', '1 Expansion Permit'],
  25: ['Town Level milestone gift'],
  30: ['Order board grows to 6 slots', '1 Expansion Permit'],
  40: ['1 Expansion Permit'],
};

export function isBuildingUnlocked(type, townLevel) {
  return townLevel >= (BUILDING_UNLOCK[type] ?? 1);
}

export function buildingUnlockLevel(type) {
  return BUILDING_UNLOCK[type] ?? 1;
}

// ---------------------------------------------------------------- order board

export function boardSlots(townLevel) {
  return 3 + (townLevel >= 5 ? 1 : 0) + (townLevel >= 22 ? 1 : 0) + (townLevel >= 30 ? 1 : 0);
}

// The Town order board. Exported so scripts/check-levels.mjs can audit it: Town mode has no
// authored per-level pool, so this table is the only place its demand is defined.
export const TOWN_ORDER_POOL = [
  { type: 'washedPeach', min: 1, price: 10, rep: 1 },
  { type: 'washedApple', min: 1, price: 10, rep: 1 },
  { type: 'peachBase', min: 2, price: 14, rep: 2 },
  { type: 'appleBase', min: 2, price: 14, rep: 2 },
  { type: 'brewedTea', min: 3, price: 22, rep: 3 },
  { type: 'tub', min: 8, price: 32, rep: 4 },
  { type: 'fruitTart', min: 20, price: 48, rep: 5 },
];

function lcg(seed) {
  let x = (seed * 2654435761) >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// A pure function of the state (town level and queue index), so the same save always
// produces the same board. Every product it asks for is unlocked at that Town Level.
export function townTemplate(s) {
  const level = Math.max(1, s.townLevel || 1);
  const index = s.orders.queueIndex || 0;
  const rnd = lcg(index * 7919 + level * 104729 + 17);
  const eligible = TOWN_ORDER_POOL.filter(p => p.min <= level);
  const first = eligible[Math.floor(rnd() * eligible.length)];
  const qty = 1 + (level >= 6 ? 1 : 0) + (level >= 16 ? 1 : 0);
  const items = [{ type: first.type, qty: 1 + Math.floor(rnd() * qty) }];
  if (level >= 12 && eligible.length > 1 && rnd() < 0.4) {
    const others = eligible.filter(p => p.type !== first.type);
    const second = others[Math.floor(rnd() * others.length)];
    items.push({ type: second.type, qty: 1 });
  }
  let reward = 0;
  let rep = 0;
  for (const it of items) {
    const p = TOWN_ORDER_POOL.find(x => x.type === it.type);
    reward += p.price * it.qty;
    rep += p.rep * it.qty;
  }
  reward = Math.round(reward * (1.15 + Math.min(level, 30) * 0.01));
  // Board orders never expire into failure, so patience is effectively unlimited.
  return {
    id: `board-${index}`,
    items,
    reward,
    rep,
    patience: 99999,
    gap: 12,
    bonusTiers: [
      { within: 30 * 10, reward: Math.max(1, Math.round(reward * 0.25)) },
      { within: 90 * 10, reward: Math.max(1, Math.round(reward * 0.1)) },
    ],
  };
}

// ---------------------------------------------------------------- land expansion

export const EXPANSIONS = [
  { x1: 19, y1: 15, name: 'Starter district', level: 1, coins: 0, permits: 0 },
  { x1: 28, y1: 19, name: 'Orchard row', level: 8, coins: 300, permits: 1 },
  { x1: 37, y1: 23, name: 'Market quarter', level: 22, coins: 700, permits: 2 },
];

export function nextExpansion(profile) {
  ensureTown(profile);
  return EXPANSIONS[profile.expansion + 1] || null;
}

export function canExpand(profile, coins) {
  const next = nextExpansion(profile);
  if (!next) return { ok: false, reason: 'The whole town is already open.' };
  if (profile.townLevel < next.level) return { ok: false, reason: `Reach Town Level ${next.level} first.` };
  if (profile.permits < next.permits) return { ok: false, reason: `Needs ${next.permits} Expansion Permit${next.permits > 1 ? 's' : ''}.` };
  if (coins < next.coins) return { ok: false, reason: `Needs ${next.coins} coins.` };
  return { ok: true, next };
}

// ---------------------------------------------------------------- story

export const STORY = [
  {
    id: 'c1', title: 'Opening Day', who: 'Mo the Mole', minLevel: 1,
    intro: 'Mo hands you the keys. "The market opens at noon. Let us not keep the customers waiting."',
    steps: [
      { text: 'Serve 3 orders', stat: 'fulfilled', n: 3, coins: 30, xp: 20 },
      { text: 'Serve 2 Peach Cups', stat: 'byType:washedPeach', n: 2, coins: 25, xp: 20 },
      { text: 'Serve 8 orders', stat: 'fulfilled', n: 8, coins: 50, xp: 40 },
    ],
  },
  {
    id: 'c2', title: 'Pressed for Time', who: 'Sprig the Squirrel', minLevel: 2,
    intro: 'Sprig sets down a jar. "Smooth puree sells for more. Build a press line and watch the till."',
    steps: [
      { text: 'Serve 2 puree orders', stat: 'baseOrders', n: 2, coins: 40, xp: 30 },
      { text: 'Serve 5 puree orders', stat: 'baseOrders', n: 5, coins: 60, xp: 50 },
      { text: 'Serve 25 orders in total', stat: 'fulfilled', n: 25, coins: 80, xp: 60 },
    ],
  },
  {
    id: 'c3', title: 'Tea Time', who: 'Pip the Rabbit', minLevel: 3,
    intro: 'Pip bounces in. "Leaves in socket A, water in socket B. Everyone in town wants a cup of calm."',
    steps: [
      { text: 'Serve 2 teas', stat: 'teaOrders', n: 2, coins: 50, xp: 40 },
      { text: 'Serve 6 teas', stat: 'teaOrders', n: 6, coins: 80, xp: 70 },
      { text: 'Serve 50 orders in total', stat: 'fulfilled', n: 50, coins: 120, xp: 90 },
    ],
  },
  {
    id: 'c4', title: 'The Cold Room', who: 'Nori the Otter', minLevel: 8,
    intro: 'Nori taps the freezer door. "Ice cream melts on the belt. Short routes, steady hands."',
    steps: [
      { text: 'Serve 1 ice cream', stat: 'tubOrders', n: 1, coins: 80, xp: 70 },
      { text: 'Serve 5 ice creams', stat: 'tubOrders', n: 5, coins: 140, xp: 120 },
      { text: 'Serve 100 orders in total', stat: 'fulfilled', n: 100, coins: 200, xp: 160 },
    ],
  },
  {
    id: 'c5', title: 'Market Day', who: 'The whole town', minLevel: 12,
    intro: 'The square fills with neighbours. "Big orders today, and some want two things at once."',
    steps: [
      { text: 'Serve 150 orders in total', stat: 'fulfilled', n: 150, coins: 250, xp: 200 },
      { text: 'Serve 20 ice creams', stat: 'tubOrders', n: 20, coins: 300, xp: 250 },
      { text: 'Serve 300 orders in total', stat: 'fulfilled', n: 300, coins: 500, xp: 400 },
    ],
  },
];

export function statValue(profile, stat) {
  const st = profile.stats;
  if (stat.startsWith('byType:')) return st.byType[stat.slice(7)] || 0;
  return st[stat] || 0;
}

// Records a served order into the lifetime stats that story and daily goals read.
export function recordOrder(profile, order) {
  ensureTown(profile);
  const st = profile.stats;
  st.fulfilled++;
  let hasBase = false;
  let hasTea = false;
  let hasTub = false;
  let hasTart = false;
  for (const it of order.items || []) {
    st.items += it.qty || 0;
    st.byType[it.type] = (st.byType[it.type] || 0) + (it.qty || 0);
    if (it.type === 'peachBase' || it.type === 'appleBase') hasBase = true;
    if (it.type === 'brewedTea') hasTea = true;
    if (it.type === 'tub') hasTub = true;
    if (it.type === 'fruitTart') hasTart = true;
  }
  if (hasBase) st.baseOrders++;
  if (hasTea) st.teaOrders++;
  if (hasTub) st.tubOrders++;
  if (hasTart) st.tartOrders++;
  const now = Date.now();
  profile.recent.push({ t: now, c: order.reward || 0 });
  profile.recent = profile.recent.filter(r => now - r.t < 10 * 60 * 1000).slice(-30);
}

export function currentChapter(profile) {
  ensureTown(profile);
  if (profile.story.chapter < STORY.length) return STORY[profile.story.chapter];
  const chapter = profile.story.chapter;
  let loop = profile.story.activeLoop;
  if (!loop || loop.chapter !== chapter) {
    const episode = chapter - STORY.length + 1;
    const unlockedGoals = ['fulfilled'];
    if (profile.townLevel >= 2) unlockedGoals.push('baseOrders');
    if (profile.townLevel >= 3) unlockedGoals.push('teaOrders');
    if (profile.townLevel >= 8) unlockedGoals.push('tubOrders');
    if (profile.townLevel >= 20) unlockedGoals.push('tartOrders');
    const stat = unlockedGoals[(episode - 1) % unlockedGoals.length];
    loop = {
      chapter,
      stat,
      startValue: statValue(profile, stat),
    };
    profile.story.activeLoop = loop;
  }
  return sagaChapter(chapter - STORY.length + 1, loop.stat, loop.startValue);
}

const SAGA_NEIGHBOURS = [
  { who: 'Mo the Mole', title: 'A Wider Welcome', intro: 'Mo studies the growing market. "There is room for everyone if we keep the ovens busy."' },
  { who: 'Sprig the Squirrel', title: 'Branches of Trade', intro: 'Sprig arrives with a fresh map. "Our little routes are reaching farther every week."' },
  { who: 'Pip the Rabbit', title: 'More Cups to Fill', intro: 'Pip waves from the square. "The neighbours brought friends. Let us make them feel at home."' },
  { who: 'Nori the Otter', title: 'A Cooler Welcome', intro: 'Nori checks the cold room. "The town is growing. Let us keep every order fresh."' },
  { who: 'The whole town', title: 'A Town Tradition', intro: 'Neighbours gather at the landmark to celebrate another season of good food.' },
];

function sagaChapter(episode, stat, startValue) {
  const neighbour = SAGA_NEIGHBOURS[(episode - 1) % SAGA_NEIGHBOURS.length];
  const pace = Math.floor(Math.sqrt(episode));
  const goals = [6 + pace, 14 + pace * 2, 26 + pace * 3];
  const rewardScale = Math.min(8, 1 + Math.floor(Math.sqrt(episode) / 2));
  const unit = SAGA_GOALS[stat].unit;
  return {
    id: `saga-${episode}`,
    title: `${neighbour.title} · Saga ${episode}`,
    who: neighbour.who,
    minLevel: 1,
    intro: neighbour.intro,
    steps: goals.map((n, i) => ({
      text: `Serve ${startValue + n} ${unit} in total`,
      stat,
      n: startValue + n,
      coins: (70 + i * 35) * rewardScale,
      xp: (50 + i * 30) * rewardScale,
    })),
  };
}

// What the HUD shows: the chapter, the current step and how far along it is.
export function storyStatus(profile) {
  const ch = currentChapter(profile);
  if (!ch) return { done: true, title: 'Story complete', text: 'The town thrives. More chapters are coming.', have: 0, need: 0 };
  if (profile.townLevel < ch.minLevel) {
    return { locked: true, title: ch.title, text: `Reach Town Level ${ch.minLevel} to meet ${ch.who}`, have: 0, need: 0 };
  }
  const step = ch.steps[profile.story.step];
  const need = step.n;
  const have = Math.min(statValue(profile, step.stat), need);
  return { title: ch.title, who: ch.who, text: step.text, have, need, stepNo: profile.story.step + 1, steps: ch.steps.length };
}

// Advances the story. Returns events the caller turns into rewards and toasts.
export function advanceStory(profile) {
  ensureTown(profile);
  const events = [];
  for (let guard = 0; guard < 20; guard++) {
    const ch = currentChapter(profile);
    if (!ch || profile.townLevel < ch.minLevel) break;
    if (profile.story.step === 0 && !profile.story.introSeen?.[ch.id]) {
      profile.story.introSeen = { ...(profile.story.introSeen || {}), [ch.id]: true };
      events.push({ kind: 'intro', chapter: ch });
    }
    const step = ch.steps[profile.story.step];
    if (statValue(profile, step.stat) < step.n) break;
    events.push({ kind: 'step', chapter: ch, step, coins: step.coins, xp: step.xp });
    profile.story.step++;
    if (profile.story.step >= ch.steps.length) {
      profile.story.chapter++;
      profile.story.step = 0;
      profile.story.activeLoop = null;
      profile.landmark++;
      const permits = profile.expansion < EXPANSIONS.length - 1 ? 1 : 0;
      const coins = permits ? 0 : 150;
      profile.permits += permits;
      events.push({ kind: 'chapter', chapter: ch, permits, coins });
    }
  }
  return events;
}

// ---------------------------------------------------------------- daily goals and streak

const DAILY_TYPES = [
  { stat: 'fulfilled', min: 1, label: n => `Serve ${n} orders`, base: 4, per: 0.25 },
  { stat: 'items', min: 1, label: n => `Deliver ${n} items`, base: 6, per: 0.35 },
  { stat: 'baseOrders', min: 2, label: n => `Serve ${n} puree orders`, base: 2, per: 0.12 },
  { stat: 'teaOrders', min: 3, label: n => `Serve ${n} teas`, base: 2, per: 0.12 },
  { stat: 'tubOrders', min: 8, label: n => `Serve ${n} ice creams`, base: 1, per: 0.08 },
  { stat: 'tartOrders', min: 20, label: n => `Serve ${n} fruit tarts`, base: 1, per: 0.05 },
];

export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekKey(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime());
}

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// Generates a fresh set of goals on a new local day. Returns true when it did.
export function ensureDaily(profile, now = Date.now()) {
  ensureTown(profile);
  const today = dayKey(now);
  const d = profile.daily;
  if (d && d.day === today && Array.isArray(d.goals)) return false;
  const level = profile.townLevel;
  const eligible = DAILY_TYPES.filter(t => t.min <= level);
  const seed = dayNumber(today);
  const rnd = lcg(seed + level);
  const picked = [eligible[0]];
  const rest = eligible.slice(1);
  while (picked.length < 3 && rest.length) {
    picked.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
  }
  while (picked.length < 3) picked.push(eligible[0]);
  const goals = picked.map((t, i) => {
    const n = Math.max(1, Math.round(t.base + t.per * level) + (picked.indexOf(t) !== i ? 3 : 0));
    return { stat: t.stat, target: n, label: t.label(n), base: statValue(profile, t.stat), claimed: false };
  });
  const prevDay = d?.day;
  let streak = d?.streak || 0;
  // The streak counts days played. A missed day pauses it; it is never reduced.
  streak += 1;
  profile.daily = { day: today, goals, streak, chestClaimed: false, previous: prevDay || null };
  return true;
}

const WEEKLY_TYPES = [
  { stat: 'fulfilled', min: 1, label: n => `Serve ${n} orders`, base: 14, per: 0.4 },
  { stat: 'items', min: 1, label: n => `Deliver ${n} items`, base: 20, per: 0.6 },
  { stat: 'baseOrders', min: 2, label: n => `Serve ${n} puree orders`, base: 7, per: 0.2 },
  { stat: 'teaOrders', min: 3, label: n => `Serve ${n} teas`, base: 7, per: 0.2 },
  { stat: 'tubOrders', min: 8, label: n => `Serve ${n} ice creams`, base: 4, per: 0.1 },
  { stat: 'tartOrders', min: 20, label: n => `Serve ${n} fruit tarts`, base: 3, per: 0.08 },
];

// Weekly goals count progress only from the start of the current local week.
// Missing a goal never affects Town Level, story progress, or an existing save.
export function ensureWeekly(profile, now = Date.now()) {
  ensureTown(profile);
  const current = weekKey(now);
  if (profile.weekly?.week === current && Array.isArray(profile.weekly.goals)) return false;
  const eligible = WEEKLY_TYPES.filter(t => t.min <= profile.townLevel);
  const seed = Math.floor(dayNumber(current) / 7) + profile.townLevel * 31;
  const rnd = lcg(seed);
  const pool = [...eligible];
  const goals = [];
  while (goals.length < 2 && pool.length) {
    const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const target = Math.max(1, Math.round(Math.min(30, t.base + t.per * profile.townLevel)));
    goals.push({ stat: t.stat, target, label: t.label(target), base: statValue(profile, t.stat), claimed: false });
  }
  profile.weekly = { week: current, goals };
  return true;
}

export function weeklyProgress(profile, goal) {
  return Math.min(goal.target, Math.max(0, statValue(profile, goal.stat) - goal.base));
}

export function claimWeeklyGoal(profile, index) {
  ensureTown(profile);
  const goal = profile.weekly?.goals?.[index];
  if (!goal || goal.claimed || weeklyProgress(profile, goal) < goal.target) return null;
  goal.claimed = true;
  return { coins: Math.min(500, 120 + profile.townLevel * 4), xp: 100 };
}

export function dailyProgress(profile, goal) {
  return Math.min(goal.target, Math.max(0, statValue(profile, goal.stat) - goal.base));
}

export function claimDaily(profile, index) {
  ensureTown(profile);
  const d = profile.daily;
  const goal = d?.goals?.[index];
  if (!goal || goal.claimed || dailyProgress(profile, goal) < goal.target) return null;
  goal.claimed = true;
  return { coins: Math.min(250, 25 + profile.townLevel * 3), xp: 20 };
}

export function claimChest(profile) {
  ensureTown(profile);
  const d = profile.daily;
  if (!d || d.chestClaimed || !d.goals.every(g => g.claimed)) return null;
  d.chestClaimed = true;
  const earnsPermit = d.streak % 3 === 0;
  const permit = earnsPermit && profile.expansion < EXPANSIONS.length - 1 ? 1 : 0;
  profile.permits += permit;
  const coins = Math.min(500, 50 + profile.townLevel * 5) + (earnsPermit && !permit ? 100 : 0);
  return { coins, permits: permit };
}

// ---------------------------------------------------------------- overnight batch

// 50% of the throughput measured in the 10 active minutes before the player left, capped
// at 4 hours. Computed arithmetically, so it is cheap and the same on every device.
export function overnightBatch(profile, now = Date.now()) {
  ensureTown(profile);
  const left = profile.lastSeenAt;
  if (!Number.isFinite(left)) return null;
  const awayMin = Math.min(240, (now - left) / 60000);
  if (awayMin < 5) return null;
  const recent = profile.recent.filter(r => left - r.t < 10 * 60 * 1000 && r.t <= left);
  if (!recent.length) return null;
  const perMin = recent.reduce((a, r) => a + r.c, 0) / 10;
  const coins = Math.round(perMin * 0.5 * awayMin);
  if (coins <= 0) return null;
  return { coins, xp: Math.round(coins / 4), minutes: Math.round(awayMin) };
}
