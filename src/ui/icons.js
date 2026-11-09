// Original line icons drawn for the game. No external icon packs, no traced artwork.

const OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const END = '</svg>';

function wrap(inner, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${inner}</svg>`;
}

export const ICONS = {
  coin: wrap('<circle cx="12" cy="12" r="8.2"/><path d="M9.4 8.6h5.2M9.4 12h5.2M9.4 15.4h5.2"/><circle cx="12" cy="12" r="3.1"/>'),
  rep: wrap('<path d="M12 3.6l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8z"/>'),
  clock: wrap('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.1 1.9"/>'),
  play: wrap('<path d="M8.2 5.6l10 6.4-10 6.4z" fill="currentColor" stroke="none"/>'),
  pause: wrap('<rect x="7" y="5" width="3.6" height="14" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.1" fill="currentColor" stroke="none"/>'),
  speed: wrap('<path d="M4 8.5l6 3.5-6 3.5zM13 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3.1"/><path d="M12 2.9v2.4M12 18.7v2.4M4.6 6.9l2 1.2M17.4 15.9l2 1.2M4.6 17.1l2-1.2M17.4 8.1l2-1.2"/>'),
  home: wrap('<path d="M4 10.6L12 4l8 6.6V20h-5.4v-6.2H9.4V20H4z"/>'),
  build: wrap('<path d="M5 19l8.2-8.2M13.6 4.4l2.3 2.3-2.7 2.7-2.3-2.3zM15.9 6.7l3.2 3.2-3.7 3.7-3.2-3.2zM4.6 16.9l2.5 2.5"/>'),
  orders: wrap('<path d="M6 3.8h12v16.4l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6z"/><path d="M9 8h6M9 11.6h6M9 15.2h3.6"/>'),
  inspect: wrap('<circle cx="10.6" cy="10.6" r="5.9"/><path d="M15 15l4.8 4.8"/><path d="M8.4 10.6h4.4"/>'),
  check: wrap('<path d="M4.8 12.6l4.6 4.6L19.4 7"/>'),
  x: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  warn: wrap('<path d="M12 4l8.6 15H3.4z"/><path d="M12 9.4v4.2"/><circle cx="12" cy="16.6" r="0.5" fill="currentColor"/>'),
  lock: wrap('<rect x="5.2" y="10.2" width="13.6" height="10" rx="2.4"/><path d="M8.4 10.2V7.9a3.6 3.6 0 017.2 0v2.3"/>'),
  rotate: wrap('<path d="M20.4 11.2a8.4 8.4 0 11-2.6-6"/><path d="M20.6 3.8v5h-5"/>'),
  move: wrap('<path d="M12 3.4v17.2M3.4 12h17.2M9.4 6l2.6-2.6L14.6 6M9.4 18l2.6 2.6 2.6-2.6M6 9.4L3.4 12 6 14.6M18 9.4l2.6 2.6-2.6 2.6"/>'),
  trash: wrap('<path d="M4.6 7h14.8M9.4 7V4.6h5.2V7M6.8 7l1 13h8.4l1-13"/><path d="M10.4 10.4v6M13.6 10.4v6"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  minus: wrap('<path d="M5 12h14"/>'),
  arrow: wrap('<path d="M4.4 12h15.2M13.4 5.8L19.6 12l-6.2 6.2"/>'),
  zoomIn: wrap('<circle cx="10.4" cy="10.4" r="6"/><path d="M15 15l5 5M8 10.4h4.8M10.4 8v4.8"/>'),
  zoomOut: wrap('<circle cx="10.4" cy="10.4" r="6"/><path d="M15 15l5 5M8 10.4h4.8"/>'),
  sound: wrap('<path d="M4.4 9.4h3.4L13 5v14l-5.2-4.4H4.4z"/><path d="M16.2 8.4a5 5 0 010 7.2M18.8 5.8a8.6 8.6 0 010 12.4"/>'),
  music: wrap('<path d="M9.4 17.2V6.2L19 4.4v10.4"/><circle cx="7" cy="17.6" r="2.6"/><circle cx="16.6" cy="15.4" r="2.6"/>'),
  sparkle: wrap('<path d="M12 3.4l1.9 4.9 4.9 1.9-4.9 1.9L12 17l-1.9-4.9L5.2 10.2l4.9-1.9z"/><path d="M18.6 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
  leaf: wrap('<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19c3.2-4.4 6.8-7.2 11-9.2"/>'),
  heart: wrap('<path d="M12 20.2C6.6 16.4 3.8 13.2 3.8 9.8A4.1 4.1 0 0112 7.6a4.1 4.1 0 018.2 2.2c0 3.4-2.8 6.6-8.2 10.4z"/>'),
  users: wrap('<circle cx="9" cy="8.4" r="3.2"/><path d="M3.6 20c0-3.4 2.4-5.6 5.4-5.6s5.4 2.2 5.4 5.6"/><circle cx="17" cy="9.4" r="2.4"/><path d="M16 14.6c2.6.2 4.4 2.1 4.4 5"/>'),
  info: wrap('<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4"/><circle cx="12" cy="7.8" r="0.7" fill="currentColor"/>'),
  snow: wrap('<path d="M12 3.4v17.2M4.6 7.7l14.8 8.6M19.4 7.7L4.6 16.3"/><path d="M9.2 5.4L12 8l2.8-2.6M9.2 18.6L12 16l2.8 2.6"/>'),
  camera: wrap('<path d="M4 8.2h3l1.6-2.4h6.8L17 8.2h3V19H4z"/><circle cx="12" cy="13.4" r="3.4"/>'),
  eye: wrap('<path d="M2.8 12S6.2 6.4 12 6.4 21.2 12 21.2 12 17.8 17.6 12 17.6 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="3"/>'),
  grid: wrap('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.4 4v16M14.6 4v16M4 9.4h16M4 14.6h16"/>'),
  chart: wrap('<path d="M4.4 19.6h15.2"/><rect x="6" y="11.4" width="3.2" height="7.2" rx="1"/><rect x="10.4" y="7" width="3.2" height="11.6" rx="1"/><rect x="14.8" y="13.4" width="3.2" height="5.2" rx="1"/>'),
  hand: wrap('<path d="M8.6 12.4V6.2a1.6 1.6 0 013.2 0v5.2M11.8 11V4.8a1.6 1.6 0 013.2 0V11M15 11V6.8a1.6 1.6 0 013.2 0v7.4c0 3.4-2.2 5.8-5.4 5.8h-1c-2 0-3.2-.8-4.4-2.4L4.6 13a1.6 1.6 0 012.4-2.1l1.6 1.5z"/>'),
};

export const ITEM_SVG = {
  fruit(tint, dark) {
    return wrap(`<path d="M12.4 6.8c0-1.8 1.2-3 2.9-3.2" stroke="${dark}"/><path d="M12.4 6.4c-1.1-1.4-2.6-1.6-3.7-1.2.9 1.3 2 1.8 3.7 1.2z" fill="${dark}" stroke="none"/><circle cx="12" cy="13.4" r="6.2" fill="${tint}" stroke="${dark}"/><path d="M12 7.2c-2 1.8-2 8.2 0 12.4" stroke="${dark}" stroke-width="1.1" opacity=".5"/>`);
  },
  leaf(tint, dark) {
    return wrap(`<path d="M6 18.6C6 10.8 10.4 5.8 19 5.6c0 8.4-4.6 13-13 13z" fill="${tint}" stroke="${dark}"/><path d="M6.2 18.4c3-4 6.2-6.8 10.2-8.8" stroke="${dark}"/>`);
  },
  drop(tint, dark) {
    return wrap(`<path d="M12 3.6c3.4 4.2 5.4 7 5.4 9.6a5.4 5.4 0 01-10.8 0c0-2.6 2-5.4 5.4-9.6z" fill="${tint}" stroke="${dark}"/><path d="M9.4 13.2a2.8 2.8 0 002.6 2.8" stroke="#fff" opacity=".7"/>`);
  },
  cream(tint, dark) {
    return wrap(`<path d="M8.4 8.6h7.2l1.2 11H7.2z" fill="${tint}" stroke="${dark}"/><path d="M9.6 8.6V4.8h4.8v3.8" stroke="${dark}"/><path d="M8.6 12.4h6.8M8.8 15.6h6.4" stroke="${dark}" opacity=".55"/>`);
  },
  washed(tint, dark) {
    return wrap(`<path d="M5.4 9.4h13.2l-1.4 8.8a2 2 0 01-2 1.7H8.8a2 2 0 01-2-1.7z" fill="${tint}" stroke="${dark}"/><path d="M4.6 9.4h14.8" stroke="${dark}"/><circle cx="10.2" cy="7" r="2.1" fill="${tint}" stroke="${dark}"/><path d="M12.6 5.4c.5-1 1.5-1.4 2.4-1.2" stroke="${dark}"/>`);
  },
  jar(tint, dark) {
    return wrap(`<rect x="7" y="7.6" width="10" height="12.2" rx="2.2" fill="${tint}" stroke="${dark}"/><path d="M8 7.4V5.2h8v2.2M8.4 4.2h7.2" stroke="${dark}"/><path d="M7.6 12h8.8" stroke="${dark}" opacity=".55"/>`);
  },
  cup(tint, dark) {
    return wrap(`<path d="M5.4 8.6h10.4v5.2a4.4 4.4 0 01-4.4 4.4H9.8a4.4 4.4 0 01-4.4-4.4z" fill="${tint}" stroke="${dark}"/><path d="M15.8 10.2h1.8a2.4 2.4 0 010 4.8h-1.8" stroke="${dark}"/><path d="M5 19h11.6M8.2 5.6c.3-1 1-1.4 1.8-1.4M11.6 5.6c.3-1 1-1.4 1.8-1.4" stroke="${dark}"/>`);
  },
  mix(tint, dark) {
    return wrap(`<path d="M5.4 9.6h13.2v3.8a5 5 0 01-5 5h-3.2a5 5 0 01-5-5z" fill="${tint}" stroke="${dark}"/><path d="M8.4 9.6c1.2-2 2.6-2.8 3.9-2.8 1.5 0 2.4.7 3 1.6" stroke="${dark}"/><path d="M8.8 13.6c1.4 1 3.4 1 4.8 0" stroke="${dark}" opacity=".6"/>`);
  },
  tub(tint, dark) {
    return wrap(`<path d="M5.4 9.4h13.2l-1.1 8.4a2.4 2.4 0 01-2.4 2.1H8.9a2.4 2.4 0 01-2.4-2.1z" fill="${tint}" stroke="${dark}"/><path d="M4.6 9.4h14.8M7.6 6.2h8.8v3.2H7.6z" fill="#fff" stroke="${dark}"/><path d="M9 13.4c1.6 1 4.4 1 6 0" stroke="${dark}" opacity=".6"/>`);
  },
  melted(tint, dark) {
    return wrap(`<path d="M4.4 15.6c1.2-1.4 2.6-1.4 3.8 0 1.2 1.4 2.6 1.4 3.8 0 1.2-1.4 2.6-1.4 3.8 0 1.2 1.4 2.6 1.4 3.8 0v3.2c0 .8-.7 1.4-1.5 1.4H5.9c-.8 0-1.5-.6-1.5-1.4z" fill="${tint}" stroke="${dark}"/><path d="M8.6 12.4c.4-1.6 1.6-2.4 3.4-2.4s3 .8 3.4 2.4" stroke="${dark}" opacity=".55"/>`);
  },
};

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export function itemIcon(type, ITEMS) {
  const it = ITEMS[type];
  if (!it) return ICONS.info;
  const fn = ITEM_SVG[it.form] || ITEM_SVG.fruit;
  return fn(hex(it.tint), hex(it.tint2));
}

const BUILDING_PATHS = {
  orchard: '<path d="M12 13.4v6"/><circle cx="8.4" cy="10.6" r="3.1"/><circle cx="15.4" cy="8.8" r="3.6"/><path d="M4.6 19.4h14.8"/>',
  teaPatch: '<path d="M12 19.6V9.4"/><path d="M12 12.4C8.4 12.4 6 10.6 6 7c3.6 0 6 2 6 5.4z"/><path d="M12 9.8c0-3 1.8-5 5.2-5 0 3.2-1.8 5-5.2 5z"/><path d="M7.4 19.6h9.2"/>',
  waterPump: '<path d="M6 19.6h12M8.4 19.6V8.2h6.2v11.4"/><path d="M14.6 10.4h3.8v3.2h-3.8"/><circle cx="11.4" cy="6.2" r="2.2"/>',
  dairyCrate: '<path d="M4.6 9.4h14.8v10.2H4.6z"/><path d="M4.6 12.6h14.8M9.2 9.4v10.2M14.8 9.4v10.2"/><path d="M10 6.8h4v2.6h-4z"/>',
  washer: '<rect x="4.6" y="4.4" width="14.8" height="15.2" rx="2.4"/><circle cx="12" cy="12.8" r="4.4"/><path d="M7.4 7.4h1.2M10 7.4h1.2"/>',
  press: '<path d="M5 8.4h14M6.4 4.6h11.2v3.8H6.4zM9.4 8.4v4.2h5.2V8.4"/><path d="M7 16.4h10v3.4H7z"/>',
  brewer: '<path d="M5.6 9.4h10.8v6.2a3.4 3.4 0 01-3.4 3.4H9a3.4 3.4 0 01-3.4-3.4z"/><path d="M16.4 10.8h2a2.2 2.2 0 010 4.4h-2"/><path d="M8.4 5.6c.2-1.4 1.2-2 2-2M12 5.6c.2-1.4 1.2-2 2-2"/>',
  mixer: '<path d="M4.6 10.4h14.8v2.2a5.4 5.4 0 01-5.4 5.4H10a5.4 5.4 0 01-5.4-5.4z"/><path d="M12 10.2V4.4M8.6 6.4l6.8-2"/>',
  freezer: '<rect x="4.8" y="4.4" width="14.4" height="15.2" rx="2.4"/><path d="M12 8v8M8.6 10l6.8 4M15.4 10l-6.8 4"/><path d="M5 17h14" opacity=".5"/>',
  counter: '<path d="M4 8.4h16M5.4 8.4v4.8h13.2V8.4"/><path d="M6.6 13.2v6.4M17.4 13.2v6.4M10 16h4.2"/><path d="M5.4 8.4l1.6-3h10l1.6 3"/>',
  belt: '<path d="M3.6 12h4.2M16.2 12h4.2"/><rect x="7.8" y="9.4" width="8.4" height="5.2" rx="1.4"/><path d="M9.6 9.4v5.2M12 9.4v5.2M14.4 9.4v5.2"/><path d="M17 9l3 3-3 3"/>',
};

export function buildingIcon(type) {
  return wrap(BUILDING_PATHS[type] || '<rect x="5" y="5" width="14" height="14" rx="2"/>');
}

export function brandMark() {
  return `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M5 21.4h22l-2.2 6.2a2 2 0 01-1.9 1.3H9.1a2 2 0 01-1.9-1.3z" fill="#fff6e7"/>
    <path d="M8.6 21.4c0-5.4 3-8.8 7.4-8.8s7.4 3.4 7.4 8.8" stroke="#fff6e7" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M16 12.6V8.4" stroke="#fff6e7" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="16" cy="6.6" r="2.2" fill="#fff6e7"/>
  </svg>`;
}

export function customerSilhouette(i) {
  const tint = ['#8e4f53', '#708549', '#6e7428'][i % 3];
  return `<svg viewBox="0 0 32 40" fill="none" aria-hidden="true">
    <circle cx="16" cy="10" r="7" fill="${tint}"/>
    <path d="M4 40c0-7.6 5.2-12.6 12-12.6S28 32.4 28 40z" fill="${tint}"/>
  </svg>`;
}
