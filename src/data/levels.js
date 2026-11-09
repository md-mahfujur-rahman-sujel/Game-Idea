// Authored level data. Values follow PRD §6.8 and §10.

const FIELD = {
  x0: 2, y0: 2, x1: 37, y1: 23,
  blocked: [
    [2, 2, 2, 2], [35, 2, 2, 2], [2, 21, 2, 2], [35, 21, 2, 2],
    [18, 11, 4, 4],
  ],
};

const PATIENCE = { tutorial: 180, early: 120, late: 90 };

function order(id, items, reward, rep, patience, gap) {
  return { id, items, reward, rep, patience, gap };
}

export const LEVELS = [
  {
    id: 'tutorial',
    num: 'T',
    name: 'A Small Sweet Start',
    chapter: 'Chapter 1 · Sunbeam Workshop',
    intro: 'The counter is open. Grow a peach, wash it, and serve your first cup.',
    gridW: 40, gridH: 26,
    ...FIELD,
    startingCoins: 120,
    startingReputation: 0,
    creamCap: 0,
    expiryRep: 0,
    available: ['orchard', 'washer', 'belt'],
    preplaced: [
      { type: 'counter', x: 7, y: 8, rot: 0 },
    ],
    preBelts: [],
    objective: { kind: 'orders', count: 3, byType: { washedPeach: 3 }, text: 'Fulfill 3 Peach Cup orders' },
    optional: [
      { id: 'noLeave', label: 'No customer leaves', kind: 'noCustomerLeft' },
      { id: 'underTime', label: 'Finish under 4 minutes', kind: 'underTime', seconds: 240 },
    ],
    orderPool: [
      order('t1', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.tutorial, 0),
      order('t2', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.tutorial, 4),
      order('t3', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.tutorial, 14),
      order('t4', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.tutorial, 18),
      order('t5', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.tutorial, 18),
    ],
    tutorialSteps: [
      {
        text: 'Place an <b>Orchard</b> on the sunny plot. Peaches leave from its south port.',
        check: { kind: 'hasType', type: 'orchard' },
        tiles: [[3, 6], [4, 6], [3, 7], [4, 7]],
      },
      {
        text: 'Place a <b>Washer</b> east of the orchard.',
        check: { kind: 'hasType', type: 'washer' },
        tiles: [[5, 8]],
      },
      {
        text: 'Run <b>3 belts</b>: orchard peach port → washer → counter. Belts only move one step at a time.',
        check: { kind: 'playerBelts', n: 3 },
        tiles: [[3, 8], [4, 8], [6, 8]],
      },
      {
        text: 'Peaches become <b>Peach Cups</b> in the washer. The counter serves them automatically.',
        check: { kind: 'fulfilledType', type: 'washedPeach' },
      },
      {
        text: 'Serve <b>3 Peach Cups</b> to finish the tutorial.',
        check: { kind: 'levelDone' },
      },
    ],
    unlockNext: 'level1',
  },

  {
    id: 'level1',
    num: '1',
    name: 'The Long Way Around',
    chapter: 'Chapter 1 · Sunbeam Workshop',
    intro: 'Puree needs a Press. Route the washer into it, then find the long way to the counter.',
    gridW: 40, gridH: 26,
    ...FIELD,
    startingCoins: 165,
    startingReputation: 0,
    creamCap: 0,
    expiryRep: 0,
    available: ['washer', 'press', 'belt'],
    preplaced: [
      { type: 'orchard', x: 3, y: 4, rot: 0 },
      { type: 'counter', x: 15, y: 8, rot: 0 },
    ],
    preBelts: [],
    objective: {
      kind: 'orders', count: 5, minBase: 2,
      text: 'Fulfill 5 fruit orders · at least 2 purees',
    },
    optional: [
      { id: 'maxBelts', label: 'Use no more than 12 belts', kind: 'maxBelts', n: 12 },
      { id: 'noBlock30', label: 'No machine blocked for 30 s', kind: 'noBlock30' },
    ],
    orderPool: [
      order('l1-1', [{ type: 'peachBase', qty: 1 }], 14, 2, PATIENCE.early, 0),
      order('l1-2', [{ type: 'appleBase', qty: 1 }], 14, 2, PATIENCE.early, 5),
      order('l1-3', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.early, 16),
      order('l1-4', [{ type: 'peachBase', qty: 1 }], 14, 2, PATIENCE.early, 18),
      order('l1-5', [{ type: 'appleBase', qty: 1 }], 14, 2, PATIENCE.early, 18),
      order('l1-6', [{ type: 'washedApple', qty: 1 }], 10, 1, PATIENCE.early, 18),
      order('l1-7', [{ type: 'peachBase', qty: 1 }], 14, 2, PATIENCE.early, 18),
      order('l1-8', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.early, 18),
      order('l1-9', [{ type: 'appleBase', qty: 1 }], 14, 2, PATIENCE.early, 18),
    ],
    tutorialSteps: [
      {
        text: 'Add a <b>Press</b> after the Washer. Presses turn washed fruit into puree.',
        check: { kind: 'hasType', type: 'press' },
      },
      {
        text: 'Route fruit in, press it, and deliver puree to the Service Counter.',
        check: { kind: 'fulfilledType', type: 'peachBase' },
      },
    ],
    unlockNext: 'level2',
  },

  {
    id: 'level2',
    num: '2',
    name: 'A Cup of Calm',
    chapter: 'Chapter 1 · Sunbeam Workshop',
    intro: 'The fruit line already runs. Tea needs two ingredients — leaves in socket A, water in socket B.',
    gridW: 40, gridH: 26,
    ...FIELD,
    startingCoins: 195,
    startingReputation: 0,
    creamCap: 0,
    expiryRep: 1,
    available: ['teaPatch', 'waterPump', 'brewer', 'belt'],
    preplaced: [
      { type: 'orchard', x: 3, y: 4, rot: 0 },
      { type: 'washer', x: 6, y: 6, rot: 0 },
      { type: 'counter', x: 15, y: 8, rot: 0 },
    ],
    preBelts: [
      { x: 3, y: 6, dir: 0 }, { x: 4, y: 6, dir: 0 }, { x: 5, y: 6, dir: 0 },
      { x: 7, y: 6, dir: 1 }, { x: 7, y: 7, dir: 1 }, { x: 7, y: 8, dir: 0 },
      { x: 8, y: 8, dir: 0 }, { x: 9, y: 8, dir: 0 }, { x: 10, y: 8, dir: 0 },
      { x: 11, y: 8, dir: 0 }, { x: 12, y: 8, dir: 0 }, { x: 13, y: 8, dir: 0 },
      { x: 14, y: 8, dir: 0 },
    ],
    objective: {
      kind: 'orders', count: 6, byType: { brewedTea: 3 },
      text: 'Fulfill 6 orders including 3 teas',
    },
    optional: [
      { id: 'noRepLoss', label: 'No reputation loss', kind: 'noRepLoss' },
      { id: 'maxBelts', label: 'Use no more than 12 belts', kind: 'maxBelts', n: 12 },
    ],
    orderPool: [
      order('l2-1', [{ type: 'brewedTea', qty: 1 }], 22, 3, PATIENCE.early, 0),
      order('l2-2', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.early, 6),
      order('l2-3', [{ type: 'brewedTea', qty: 1 }], 22, 3, PATIENCE.early, 16),
      order('l2-4', [{ type: 'washedApple', qty: 1 }], 10, 1, PATIENCE.early, 18),
      order('l2-5', [{ type: 'brewedTea', qty: 1 }], 22, 3, PATIENCE.early, 18),
      order('l2-6', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.early, 18),
      order('l2-7', [{ type: 'washedApple', qty: 1 }], 10, 1, PATIENCE.early, 18),
      order('l2-8', [{ type: 'brewedTea', qty: 1 }], 22, 3, PATIENCE.early, 18),
      order('l2-9', [{ type: 'washedPeach', qty: 1 }], 10, 1, PATIENCE.early, 18),
    ],
    tutorialSteps: [
      {
        text: 'Build a <b>Brewer</b>. It has two labeled sockets: <b>A</b> leaves, <b>B</b> water.',
        check: { kind: 'hasType', type: 'brewer' },
      },
      {
        text: 'Place the <b>Tea Patch</b> and <b>Water Pump</b>, then belt each into its own socket.',
        check: { kind: 'hasType', type: 'teaPatch' },
      },
      {
        text: 'Brewed tea is worth more. Deliver a cup to the counter.',
        check: { kind: 'fulfilledType', type: 'brewedTea' },
      },
    ],
    unlockNext: 'level3',
  },

  {
    id: 'level3',
    num: '3',
    name: 'Chill Factor',
    chapter: 'Chapter 2 · The Cold Room',
    intro: 'Ice cream is the only thing that melts. Mix puree with cream, freeze it, and hurry.',
    gridW: 40, gridH: 26,
    ...FIELD,
    startingCoins: 300,
    startingReputation: 0,
    creamCap: 12,
    expiryRep: 1,
    available: ['dairyCrate', 'mixer', 'freezer', 'press', 'belt'],
    preplaced: [
      { type: 'orchard', x: 3, y: 4, rot: 0 },
      { type: 'washer', x: 6, y: 6, rot: 0 },
      { type: 'press', x: 8, y: 6, rot: 0 },
      { type: 'counter', x: 15, y: 8, rot: 0 },
    ],
    preBelts: [
      { x: 3, y: 6, dir: 0 }, { x: 4, y: 6, dir: 0 }, { x: 5, y: 6, dir: 0 },
      { x: 7, y: 6, dir: 0 },
    ],
    objective: {
      kind: 'orders', count: 6, byType: { tub: 2 },
      text: 'Fulfill 6 orders including 2 ice creams',
    },
    optional: [
      { id: 'noMelt', label: 'No tub melts', kind: 'noMelt' },
      { id: 'noSell', label: 'Complete without selling a machine', kind: 'noSell' },
    ],
    orderPool: [
      order('l3-1', [{ type: 'tub', qty: 1 }], 32, 4, PATIENCE.late, 0),
      order('l3-2', [{ type: 'tub', qty: 1 }], 32, 4, PATIENCE.late, 5),
      order('l3-3', [{ type: 'peachBase', qty: 1 }], 14, 2, PATIENCE.late, 14),
      order('l3-4', [{ type: 'tub', qty: 1 }], 32, 4, PATIENCE.late, 16),
      order('l3-5', [{ type: 'appleBase', qty: 1 }], 14, 2, PATIENCE.late, 16),
      order('l3-6', [{ type: 'tub', qty: 1 }], 32, 4, PATIENCE.late, 16),
      order('l3-7', [{ type: 'tub', qty: 1 }], 32, 4, PATIENCE.late, 16),
      order('l3-8', [{ type: 'tub', qty: 1 }], 32, 4, PATIENCE.late, 16),
      order('l3-9', [{ type: 'peachBase', qty: 1 }], 14, 2, PATIENCE.late, 16),
    ],
    tutorialSteps: [
      {
        text: 'Route the <b>Press</b> output into a <b>Mixer</b>, then chill the mix in a <b>Freezer</b>.',
        check: { kind: 'hasType', type: 'mixer' },
      },
      {
        text: 'Place the <b>Dairy Crate</b>. Buy cream by hand — 8 coins, never automatic.',
        check: { kind: 'boughtCream' },
      },
      {
        text: 'Tubs keep 45 s of freshness on belts — the ring above each tub is its remaining chill. Deliver one tub to the counter.',
        check: { kind: 'fulfilledType', type: 'tub' },
      },
    ],
    unlockNext: 'town',
  },

  // Persistent Town mode (PRD 6.8a). The board, unlocks and expansion come from core/town.js;
  // this entry only supplies the starting field. x1/y1 are overridden by the saved expansion.
  {
    id: 'town',
    town: true,
    num: 'Town',
    name: 'Little Batch Town',
    chapter: 'Town mode',
    intro: 'Your workshop never resets here. Fill the order board, grow the town, and follow the story.',
    gridW: 40, gridH: 26,
    ...FIELD,
    x1: 19, y1: 15,
    startingCoins: 300,
    startingReputation: 0,
    creamCap: 9999,
    expiryRep: 0,
    available: ['orchard', 'teaPatch', 'waterPump', 'dairyCrate', 'washer', 'press', 'brewer', 'mixer', 'freezer', 'belt'],
    preplaced: [
      { type: 'counter', x: 7, y: 8, rot: 0 },
      { type: 'orchard', x: 3, y: 4, rot: 0 },
    ],
    preBelts: [],
    objective: { kind: 'orders', count: 1000000000, text: 'Grow the town' },
    optional: [],
    // Town mode never reads this pool; townTemplate generates the board from TOWN_ORDER_POOL in
    // core/town.js, gated by Town Level. It stays empty so nothing mistakes it for authored data.
    orderPool: [],
    tutorialSteps: [],
    unlockNext: null,
  },
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]));
export const LEVEL_ORDER = LEVELS.map(l => l.id);

export function isBuildable(level, x, y) {
  if (x < level.x0 || x > level.x1 || y < level.y0 || y > level.y1) return false;
  for (const [bx, by, bw, bh] of level.blocked) {
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) return false;
  }
  return true;
}
