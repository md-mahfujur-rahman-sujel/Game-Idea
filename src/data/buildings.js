// Buildings, recipes and socket definitions. All balance values are data.

export const BUILDINGS = {
  orchard: {
    id: 'orchard', name: 'Orchard', cost: 40, w: 2, h: 2, cat: 'Sources',
    kind: 'source', rotatable: false,
    desc: 'Peach + apple lanes, 1 each every 6 s',
    outputs: [
      { edge: 's', tile: [0, 1], item: 'peach', every: 60, buffer: 2 },
      { edge: 'e', tile: [1, 0], item: 'apple', every: 60, buffer: 2 },
    ],
  },
  teaPatch: {
    id: 'teaPatch', name: 'Tea Patch', cost: 40, w: 2, h: 2, cat: 'Sources',
    kind: 'source', rotatable: false,
    desc: 'Tea leaves, 1 every 6 s',
    outputs: [{ edge: 's', tile: [0, 1], item: 'teaLeaf', every: 60, buffer: 2 }],
  },
  waterPump: {
    id: 'waterPump', name: 'Water Pump', cost: 30, w: 1, h: 1, cat: 'Sources',
    kind: 'source', rotatable: true,
    desc: 'Water, 1 every 5 s',
    outputs: [{ edge: 'e', tile: [0, 0], item: 'water', every: 50, buffer: 2 }],
  },
  dairyCrate: {
    id: 'dairyCrate', name: 'Dairy Crate', cost: 30, w: 1, h: 1, cat: 'Sources',
    kind: 'source', rotatable: true,
    desc: 'Buy cream by hand · 8 coins',
    outputs: [{ edge: 'e', tile: [0, 0], item: 'cream', every: 0, buffer: 2, manual: true }],
  },
  washer: {
    id: 'washer', name: 'Washer', cost: 45, w: 1, h: 1, cat: 'Production',
    kind: 'machine', inputs: [{ family: 'anyFruit', label: null }], out: 'e',
    desc: 'R1 / R2 · 3 s',
  },
  press: {
    id: 'press', name: 'Press', cost: 55, w: 1, h: 1, cat: 'Production',
    kind: 'machine', inputs: [{ family: 'anyWashed', label: null }], out: 'e',
    desc: 'R3 / R4 · 4 s',
  },
  brewer: {
    id: 'brewer', name: 'Brewer', cost: 60, w: 1, h: 1, cat: 'Production',
    kind: 'machine', inputs: [{ family: 'teaLeaf', label: 'A' }, { family: 'water', label: 'B' }], out: 'e',
    desc: 'R5 · 6 s · two sockets',
  },
  mixer: {
    id: 'mixer', name: 'Mixer', cost: 75, w: 1, h: 1, cat: 'Production',
    kind: 'machine', inputs: [{ family: 'anyBase', label: 'A' }, { family: 'cream', label: 'B' }], out: 'e',
    desc: 'R6 / R7 · 5 s · two sockets',
  },
  freezer: {
    id: 'freezer', name: 'Freezer', cost: 110, w: 2, h: 2, cat: 'Production',
    kind: 'machine', inputs: [{ family: 'mixFamily', label: null }], out: 'e',
    outCap: 4, chilled: true,
    desc: 'R8 · 8 s · chilled output 4',
  },
  counter: {
    id: 'counter', name: 'Service Counter', cost: 50, w: 2, h: 2, cat: 'Service',
    kind: 'counter', inputs: [{ family: 'counter', label: null }], outCap: 2,
    desc: 'Serves cups · chilled buffer 2',
  },
  belt: {
    id: 'belt', name: 'Belt', cost: 4, w: 1, h: 1, cat: 'Conveyors',
    kind: 'belt', desc: 'Wood slats · 1 tile/s',
  },
};

export const BUILD_ORDER = [
  'orchard', 'teaPatch', 'waterPump', 'dairyCrate',
  'washer', 'press', 'brewer', 'mixer', 'freezer',
  'belt', 'counter',
];

export const RECIPES = [
  { id: 'R1', machine: 'washer', inputs: ['peach'], out: 'washedPeach', ticks: 30 },
  { id: 'R2', machine: 'washer', inputs: ['apple'], out: 'washedApple', ticks: 30 },
  { id: 'R3', machine: 'press', inputs: ['washedPeach'], out: 'peachBase', ticks: 40 },
  { id: 'R4', machine: 'press', inputs: ['washedApple'], out: 'appleBase', ticks: 40 },
  { id: 'R5', machine: 'brewer', inputs: ['teaLeaf', 'water'], out: 'brewedTea', ticks: 60 },
  { id: 'R6', machine: 'mixer', inputs: ['peachBase', 'cream'], out: 'peachMix', ticks: 50 },
  { id: 'R7', machine: 'mixer', inputs: ['appleBase', 'cream'], out: 'appleMix', ticks: 50 },
  { id: 'R8', machine: 'freezer', inputs: ['peachMix'], out: 'tub', ticks: 80 },
  { id: 'R8a', machine: 'freezer', inputs: ['appleMix'], out: 'tub', ticks: 80 },
  { id: 'R8m', machine: 'freezer', inputs: ['melted'], out: 'tub', ticks: 40 },
];

export const UPGRADES = {
  speed: { name: 'Speed', costs: [40, 90], max: 2, desc: '−20% processing time per level' },
  cooling: { name: 'Cooling', costs: [60], max: 1, desc: 'Chilled output 4 → 8 tubs' },
};

export const SIM = {
  tickMs: 100,
  beltStep: 0.1,
  coldFreshTicks: 450,
  coldWarnTicks: 150,
  meltAutoDiscardTicks: 150,
  maxRefreezeCycles: 2,
  refreezeFreshnessLoss: 150,
  sellRefund: 0.7,
  creamPrice: 8,
  recoveryGrant: 60,
  recoveryCoinThreshold: 20,
};

export const ECONOMY = {
  washedFruit: { reward: 10, rep: 1 },
  fruitBase: { reward: 14, rep: 2 },
  tea: { reward: 22, rep: 3 },
  tub: { reward: 32, rep: 4 },
  combo: { reward: 55, rep: 6 },
  errand: { reward: 6, rep: 0 },
};
