import { BUILDINGS, BUILD_ORDER, RECIPES, SIM, UPGRADES } from '../data/buildings.js';
import { ITEMS, FAMILIES, itemName } from '../data/items.js';
import { DIR_NAME, DIR_ARROW } from '../core/iso.js';
import { socketEdge, refundFor, supplierFor } from '../core/state.js';
import { primaryProgress } from '../core/objectives.js';
import { findOrderFor } from '../core/sim.js';
import { ensureTown, xpToNext, MAX_TOWN_LEVEL, storyStatus, isBuildingUnlocked, buildingUnlockLevel } from '../core/town.js';
import { itemIcon, buildingIcon, brandMark } from './icons.js';
import { icon, escapeHtml, setSaveStatus } from './dom.js';
import { showComplete as renderCompleteBanner, levelNumberLabel } from './menu.js';

const ORDER_KINDS = {
  brewedTea: 'tea', peachBase: 'base', appleBase: 'base',
};

const fmtChill = ticks => `${Math.max(0, Math.ceil(ticks / 10))}s`;

function patienceArc(frac, seconds, low) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, frac)) * c;
  return `<div class="patience ${low ? 'low' : ''}" title="${seconds} seconds of patience left">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="rgba(34,39,42,.12)" stroke-width="4"/>
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="${low ? 'var(--danger)' : 'var(--brass)'}" stroke-width="4"
        stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 20 20)"/>
    </svg>
    <span class="num">${seconds}</span>
  </div>`;
}

function keepFocus(container, render) {
  const active = document.activeElement;
  const scrollTop = container.scrollTop;
  let act = null;
  let index = null;
  if (active && container.contains(active)) {
    act = active.dataset.act || null;
    index = active.dataset.index ?? null;
  }
  render();
  container.scrollTop = scrollTop;
  if (act) {
    const sel = index != null
      ? `[data-act="${act}"][data-index="${index}"]`
      : `[data-act="${act}"]`;
    const again = container.querySelector(sel);
    if (again) again.focus({ preventScroll: true });
  }
}

function itemChip(type, count = 1) {
  return `<span class="o-ic ${ORDER_KINDS[type] || ''}" title="${escapeHtml(itemName(type))}">${itemIcon(type, ITEMS)}</span>${count > 1 ? `<span class="x">×${count}</span>` : ''}`;
}

export class HUD {
  constructor(ctrl) {
    this.ctrl = ctrl;
    this.ui = document.getElementById('ui');
    this.buildType = null;
    this.buildRot = 0;
    this.lastTutorialKey = '';
    this.sheetName = null;
    this.el = {};
    this.make();
  }

  make() {
    const ui = this.ui;

    const topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.dataset.layer = 'hud';
    topbar.innerHTML = `
      <div class="tb-brand">
        <div class="tb-mark">${brandMark()}</div>
        <div class="tb-word">Little Batch Works<small>Sunbeam Workshop</small></div>
      </div>
      <div class="tb-objective">
        <span class="lvl" data-el="chapter"></span>
        <span class="obj" data-el="objective"></span>
      </div>
      <div class="tb-stats">
        <div class="stat-chip" title="Coins">${icon('coin')}<span data-el="coins">0</span><span class="lbl">coins</span></div>
        <div class="stat-chip" title="Reputation">${icon('rep')}<span data-el="rep">0</span><span class="lbl">rep</span></div>
        <div class="stat-chip" data-el="townchip" title="Town Level"><span class="lbl">Town Lv</span><span data-el="town">1</span><span class="lbl" data-el="xp"></span></div>
      </div>
      <div class="tb-actions">
        <span class="save-chip" title="Progress is saved automatically"><span class="dot"></span><span>Saved</span></span>
        <button class="btn btn-sm" data-act="town" data-el="townbtn" style="display:none" title="Story, daily goals and land">Town</button>
        <div class="tb-divider"></div>
        <button class="icon-btn" data-act="pause" aria-label="Pause game" title="Pause (Space)">${icon('pause')}</button>
        <button class="icon-btn" data-act="speed" aria-label="Simulation speed 1×" title="Change simulation speed">1×</button>
        <button class="icon-btn report-launch" data-act="report" aria-label="Workshop report" title="Workshop report (I)">${icon('chart')}</button>
        <button class="icon-btn" data-act="settings" aria-label="Settings" title="Settings">${icon('settings')}</button>
        <button class="icon-btn" data-act="menu" aria-label="Pause menu and exit" title="Menu">${icon('home')}</button>
      </div>`;
    ui.appendChild(topbar);
    this.el.topbar = topbar;

    const build = document.createElement('aside');
    build.className = 'panel build-panel';
    build.dataset.layer = 'hud';
    build.setAttribute('aria-label', 'Build menu');
    build.innerHTML = `
      <div class="panel-head">
        <h2>Build</h2>
        <span class="meta" data-el="buildmeta">coins</span>
        <button class="icon-btn" data-act="rotate-build" aria-label="Rotate placement" title="Rotate (R)">${icon('rotate')}</button>
        <button class="icon-btn" data-act="cancel-build" aria-label="Cancel placement" title="Cancel (Esc)">${icon('x')}</button>
      </div>
      <div class="panel-body" data-el="buildbody"></div>`;
    ui.appendChild(build);
    this.el.build = build;

    const side = document.createElement('div');
    side.className = 'side-right';
    side.dataset.layer = 'hud';
    side.innerHTML = `
      <section class="panel orders-panel" aria-label="Customer orders">
        <div class="panel-head"><h2>Orders</h2><span class="meta" data-el="ordersmeta"></span></div>
        <div class="panel-body" data-el="ordersbody"></div>
      </section>
      <section class="panel context-panel" aria-label="Inspector">
        <div class="panel-head"><h2>Inspector</h2><span class="meta" data-el="ctxmeta"></span></div>
        <div class="panel-body" data-el="ctxbody"></div>
      </section>`;
    ui.appendChild(side);
    this.el.side = side;
    this.el.orders = side.querySelector('.orders-panel');
    this.el.ordersBody = side.querySelector('[data-el="ordersbody"]');
    this.el.ordersMeta = side.querySelector('[data-el="ordersmeta"]');
    this.el.context = side.querySelector('.context-panel');
    this.el.ctxBody = side.querySelector('[data-el="ctxbody"]');
    this.el.ctxMeta = side.querySelector('[data-el="ctxmeta"]');
    this.el.buildBody = build.querySelector('[data-el="buildbody"]');
    this.el.buildMeta = build.querySelector('[data-el="buildmeta"]');

    const tutorial = document.createElement('div');
    tutorial.className = 'tutorial';
    tutorial.dataset.layer = 'hud';
    tutorial.hidden = true;
    tutorial.innerHTML = `
      <div class="t-ic" aria-hidden="true">${icon('sparkle')}</div>
      <div class="t-main">
        <div class="t-step" data-el="tutstep"></div>
        <div class="t-text" data-el="tuttext"></div>
      </div>
      <button class="t-close" data-act="hide-hints" aria-label="Hide tutorial hints">${icon('x')}</button>`;
    ui.appendChild(tutorial);
    this.el.tutorial = tutorial;
    this.el.tutStep = tutorial.querySelector('[data-el="tutstep"]');
    this.el.tutText = tutorial.querySelector('[data-el="tuttext"]');

    const restore = document.createElement('div');
    restore.className = 't-restore';
    restore.dataset.layer = 'hud';
    restore.hidden = true;
    restore.innerHTML = `<button class="btn btn-sm btn-quiet" data-act="show-hints">${icon('sparkle')} Show tutorial hints</button>`;
    ui.appendChild(restore);
    this.el.tutRestore = restore;

    const keyhint = document.createElement('div');
    keyhint.className = 'keyhint';
    keyhint.dataset.layer = 'hud';
    keyhint.innerHTML = `
      <span><kbd>Space</kbd> pause</span>
      <span><kbd>R</kbd> rotate</span>
      <span><kbd>I</kbd> report</span>
      <span><kbd>Esc</kbd> cancel</span>
      <span><kbd>↔↕ Drag</kbd> spin &amp; tilt</span>
      <span><kbd>Right-drag</kbd> pan</span>
      <span><kbd>+</kbd><kbd>−</kbd> zoom</span>`;
    ui.appendChild(keyhint);
    this.el.keyhint = keyhint;

    const cam = document.createElement('div');
    cam.className = 'cam-controls';
    cam.dataset.layer = 'hud';
    cam.setAttribute('aria-label', 'Camera controls');
    cam.innerHTML = `
      <button class="icon-btn" data-pan="up" aria-label="Pan north">${icon('arrow').replace('transform', 'transform')}</button>
      <button class="icon-btn" data-pan="left" aria-label="Pan west">${icon('arrow')}</button>
      <button class="icon-btn" data-act="recenter" aria-label="Recenter camera" title="Recenter">${icon('eye')}</button>
      <button class="icon-btn" data-pan="right" aria-label="Pan east">${icon('arrow')}</button>
      <button class="icon-btn" data-pan="down" aria-label="Pan south">${icon('arrow')}</button>
      <button class="icon-btn" data-act="zoom-out" aria-label="Zoom out">${icon('zoomOut')}</button>
      <button class="icon-btn" data-act="zoom-in" aria-label="Zoom in">${icon('zoomIn')}</button>`;
    ui.appendChild(cam);
    this.el.cam = cam;
    this.styleCamArrows(cam);
    const orbit = document.createElement('div');
    orbit.className = 'orbit-scrub';
    orbit.innerHTML = `<button class="orbit-compass" data-act="reset-orbit" aria-label="Reset camera to north" title="Face north">
        <span class="compass-face"><span class="compass-north">N</span><span class="compass-needle"></span></span>
      </button>
      <label><span>Heading</span><input data-orbit-range type="range" min="0" max="359.9" step="0.1" value="0" aria-label="Camera compass heading">
        <span class="orbit-ticks" aria-hidden="true"><i>N</i><i>E</i><i>S</i><i>W</i><i>N</i></span>
      </label>
      <output data-orbit-value>0°</output>`;
    cam.appendChild(orbit);
    this.el.orbitRange = orbit.querySelector('[data-orbit-range]');
    this.el.orbitValue = orbit.querySelector('[data-orbit-value]');
    this.el.orbitCompass = orbit.querySelector('.orbit-compass');

    const rail = document.createElement('div');
    rail.className = 'rail';
    rail.dataset.layer = 'hud';
    rail.innerHTML = `
      <button class="icon-btn" data-sheet="build" aria-label="Open build menu">${icon('build')}</button>
      <button class="icon-btn" data-sheet="orders" aria-label="Open orders">${icon('orders')}<span class="rb" data-el="rail-orders" hidden></span></button>
      <button class="icon-btn" data-sheet="context" aria-label="Open inspector">${icon('inspect')}<span class="rb" data-el="rail-context" hidden></span></button>
      <button class="icon-btn" data-act="report" aria-label="Open workshop report">${icon('chart')}</button>`;
    ui.appendChild(rail);
    this.el.rail = rail;

    this.el.sheets = {};
    for (const [name, title, panel] of [
      ['build', 'Build', this.el.build],
      ['orders', 'Orders', this.el.orders],
      ['context', 'Inspector', this.el.context],
    ]) {
      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.dataset.layer = 'hud';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-label', title);
      sheet.innerHTML = `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close ${title.toLowerCase()}">${icon('x')}</button></div><div data-el="sheetbody"></div>`;
      ui.appendChild(sheet);
      this.el.sheets[name] = { sheet, panel, body: sheet.querySelector('[data-el="sheetbody"]'), parent: null, next: null };
    }

    const scrim = document.createElement('div');
    scrim.dataset.layer = 'hud';
    scrim.style.cssText = 'position:absolute;inset:0;z-index:44;background:rgba(24,26,30,.18);display:none;';
    ui.appendChild(scrim);
    this.el.scrim = scrim;

    this.bind();
  }

  styleCamArrows(cam) {
    const layout = {
      up: ['1 / 2', 'rotate(-90deg)'],
      left: ['2 / 1', 'rotate(180deg)'],
      recenter: ['2 / 2', ''],
      right: ['2 / 3', ''],
      down: ['3 / 2', 'rotate(90deg)'],
      'zoom-out': ['1 / 3', ''],
      'zoom-in': ['3 / 3', ''],
    };
    for (const b of cam.querySelectorAll('button')) {
      const key = b.dataset.pan || b.dataset.act;
      const cfg = layout[key];
      if (!cfg) continue;
      b.style.gridArea = cfg[0];
      const svg = b.querySelector('svg');
      if (svg && cfg[1]) svg.style.transform = cfg[1];
    }
    cam.style.display = 'grid';
    cam.style.gridTemplateColumns = 'repeat(3, auto)';
    cam.style.gridTemplateRows = 'repeat(3, auto)';
    cam.style.alignItems = 'center';
    cam.style.justifyItems = 'center';
  }

  bind() {
    this.panTimer = null;
    this.onOrbitInput = (e) => {
      if (e.target.matches('[data-orbit-range]')) this.ctrl.rotateCameraTo(Number(e.target.value));
    };
    this.ui.addEventListener('input', this.onOrbitInput);
    this.onClick = (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const act = target.dataset.act;
      const build = target.dataset.build;
      const sheet = target.dataset.sheet;
      const pan = target.dataset.pan;
      if (pan) { this.panStep(pan); return; }
      if (build) { this.ctrl.chooseBuild(build); return; }
      if (sheet) { this.toggleSheet(sheet); return; }
      if (!act) return;
      this.dispatch(act, target);
    };

    this.onPointerDown = (e) => {
      const b = e.target.closest('[data-pan]');
      if (!b) return;
      this.stopPan();
      this.panTimer = setInterval(() => this.ctrl.pan(b.dataset.pan), 70);
    };
    this.onPointerStop = () => this.stopPan();

    this.ui.addEventListener('click', this.onClick);
    this.ui.addEventListener('pointerdown', this.onPointerDown);
    this.ui.addEventListener('pointerup', this.onPointerStop);
    this.ui.addEventListener('pointercancel', this.onPointerStop);
    this.ui.addEventListener('pointerleave', this.onPointerStop);

    this.el.scrim.addEventListener('click', () => this.closeSheet());
  }

  stopPan() {
    if (this.panTimer) {
      clearInterval(this.panTimer);
      this.panTimer = null;
    }
  }

  panStep(dir) {
    this.ctrl.pan(dir);
  }

  dispatch(act, target) {
    const ctrl = this.ctrl;
    switch (act) {
      case 'pause': ctrl.togglePause(); break;
      case 'speed': ctrl.cycleSpeed(); break;
      case 'settings': ctrl.openSettings(); break;
      case 'menu': ctrl.openPause(); break;
      case 'report': ctrl.openWorkshopReport(); break;
      case 'town': ctrl.openTown(); break;
      case 'rotate-build': ctrl.rotateBuild(); break;
      case 'cancel-build': ctrl.cancelBuild(); break;
      case 'recenter': ctrl.recenter(); break;
      case 'reset-orbit': ctrl.resetCameraOrbit(); break;
      case 'zoom-in': ctrl.zoom(1.15); break;
      case 'zoom-out': ctrl.zoom(1 / 1.15); break;
      case 'hide-hints': ctrl.dismissHints(); break;
      case 'show-hints': ctrl.restoreHints(); break;
      case 'jump-stall': ctrl.jumpTo(ctrl.stall && ctrl.stall.jump); break;
      case 'jump-supplier': ctrl.jumpTo(supplierFor(ctrl.s, target.dataset.type)); break;
      case 'send-errand': ctrl.sendErrand(); break;
      case 'close-sheet': this.closeSheet(); break;
      case 'buy-cream': ctrl.buyCream(); break;
      case 'up-speed': ctrl.upgradeSpeed(); break;
      case 'up-cooling': ctrl.upgradeCooling(); break;
      case 'rotate-object': ctrl.rotateSelected(); break;
      case 'rotate-belt': ctrl.rotateSelected(); break;
      case 'move-object': ctrl.moveSelected(); break;
      case 'sell-object': ctrl.sellSelected(); break;
      case 'sell-belt': ctrl.sellSelectedBelt(); break;
      case 'remove-item': ctrl.removeSelectedItem(); break;
      case 'discard-item': ctrl.discardCounterItem(Number(target.dataset.index)); break;
      case 'discard-machine-input': ctrl.discardMachineInput(Number(target.dataset.object), Number(target.dataset.socket), Number(target.dataset.index)); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- build panel

  renderBuild() {
    const level = this.ctrl.level;
    if (!level) return;
    const byCat = new Map();
    for (const type of BUILD_ORDER) {
      if (!level.available.includes(type)) continue;
      const def = BUILDINGS[type];
      if (!byCat.has(def.cat)) byCat.set(def.cat, []);
      byCat.get(def.cat).push(type);
    }
    let html = '';
    for (const [cat, types] of byCat) {
      html += `<div class="cat">${escapeHtml(cat)}</div>`;
      for (const type of types) {
        const def = BUILDINGS[type];
        const locked = !!level.town && !isBuildingUnlocked(type, ensureTown(this.ctrl.doc.profile).townLevel);
        html += `
          <button class="bitem${locked ? ' poor' : ''}" data-locked="${locked ? 1 : 0}" data-build="${type}" aria-pressed="false" title="${escapeHtml(locked ? 'Unlocks at Town Level ' + buildingUnlockLevel(type) : def.desc)}">
            <span class="thumb">${buildingIcon(type)}</span>
            <span class="txt"><span class="nm">${escapeHtml(def.name)}</span><span class="sub">${escapeHtml(def.desc)}</span></span>
            <span class="cost">${locked ? 'Lv ' + buildingUnlockLevel(type) : icon('coin') + def.cost}</span>
          </button>`;
      }
    }
    this.el.buildBody.innerHTML = html;
    this.refreshBuildAffordability();
    this.setBuildMode(this.buildType, this.buildRot);
  }

  refreshBuildAffordability() {
    const s = this.ctrl.s;
    if (!s) return;
    for (const btn of this.el.buildBody.querySelectorAll('[data-build]')) {
      const def = BUILDINGS[btn.dataset.build];
      btn.classList.toggle('poor', s.coins < def.cost || btn.dataset.locked === '1');
    }
  }

  setBuildMode(type, rot = 0) {
    this.buildType = type;
    this.buildRot = rot;
    for (const btn of this.el.buildBody.querySelectorAll('[data-build]')) {
      const on = btn.dataset.build === type;
      btn.classList.toggle('sel', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const rotating = this.el.build.querySelector('[data-act="rotate-build"]');
    const cancel = this.el.build.querySelector('[data-act="cancel-build"]');
    rotating.style.display = type ? '' : 'none';
    cancel.style.display = type ? '' : 'none';
    this.el.buildMeta.textContent = type
      ? `${DIR_ARROW[rot]} ${DIR_NAME[rot]} · R`
      : 'coins';
    this.el.buildMeta.classList.toggle('warn', false);
  }

  // ---------------------------------------------------------------- orders

  renderOrders() {
    const s = this.ctrl.s;
    if (!s) return;
    const active = s.orders.active.filter(o => !o.errand);
    this.el.ordersMeta.textContent = `${active.length} / ${s.boardSlots || 3}`;
    this.el.ordersMeta.classList.toggle('warn', active.some(o => o.remaining < o.patienceMax * 10 * 0.25));
    const errand = s.orders.errand;

    keepFocus(this.el.ordersBody, () => {
      let html = '';
      if (errand) {
        const sent = errand.sent;
        html += `<div class="order" style="border-style:dashed">
          <div class="o-ic">${icon('hand')}</div>
          <div class="o-main">
            <div class="o-prod">Market errand</div>
            <div class="o-reward">${sent ? `Runner away · ${Math.ceil(errand.remaining / 10)}s` : `Send the runner · +${errand.reward} coins`}</div>
          </div>
          ${sent ? '' : '<button class="btn btn-sm btn-primary" data-act="send-errand">Send</button>'}
        </div>`;
      }
      if (!active.length) {
        html += `<div class="empty-note">No customers right now.<br>The next order arrives in about 16 seconds, and up to 3 wait at a time.</div>`;
      }
      for (const o of active) {
        const frac = Math.max(0, Math.min(1, o.remaining / (o.patienceMax * 10)));
        const secs = Math.ceil(o.remaining / 10);
        const urgent = frac < 0.25 ? 'urgent' : '';
        const items = o.items.map(it => itemChip(it.type, it.qty)).join('');
        const remaining = o.items.reduce((a, it) => a + it.need, 0);
        const doneCount = o.items.reduce((a, it) => a + (it.qty - it.need), 0);
        const total = o.items.reduce((a, it) => a + it.qty, 0);
        const chips = remaining
          ? o.items.filter(it => it.need > 0).map(it => this.shortageChip(s, it.type)).join('')
          : '';
        html += `<div class="order ${urgent}">
          <div class="o-prod">${items}</div>
          <div class="o-main">
            <div class="o-reward">${icon('coin')}${o.reward} <span class="rep">+${o.rep} rep</span></div>
            <div class="order-progress"><span class="done">${doneCount}/${total} delivered</span>${remaining > 1 ? ` · ${remaining} to go` : ''}</div>
            ${chips ? `<div class="order-short">${chips}</div>` : ''}
          </div>
          ${o.patienceMax >= 9999 ? '' : patienceArc(frac, secs, frac < 0.25)}
        </div>`;
      }
      this.el.ordersBody.innerHTML = html;
    });

    const dot = this.el.rail.querySelector('[data-el="rail-orders"]');
    if (dot) dot.hidden = active.length === 0;
  }

  // ---------------------------------------------------------------- context

  renderContext() {
    const ctrl = this.ctrl;
    const s = ctrl.s;
    if (!s) return;
    const sel = ctrl.selection;
    let html = '';
    let meta = 'select anything';
    if (!sel) {
      html = `<div class="ctx-empty">${icon('inspect')}<div style="margin-top:8px">Click a machine, belt, or counter to see its sockets, buffers, and a plain-language reason when it stops.</div></div>`;
    } else if (sel.kind === 'belt') {
      meta = 'belt';
      html = this.beltContext(s, sel);
    } else if (sel.kind === 'object') {
      const o = s.objects.find(x => x.id === sel.id);
      if (!o) { ctrl.clearSelection(); return; }
      meta = BUILDINGS[o.type].kind;
      html = this.objectContext(s, o);
    }

    html += this.stallFooter();
    keepFocus(this.el.ctxBody, () => { this.el.ctxBody.innerHTML = html; });
    this.el.ctxMeta.textContent = meta;
    const dot = this.el.rail.querySelector('[data-el="rail-context"]');
    if (dot) dot.hidden = !sel;
  }

  beltContext(s, sel) {
    const b = s.belts[`${sel.x},${sel.y}`];
    if (!b) return `<div class="ctx-empty">This belt was removed.</div>`;
    const item = b.item;
    let html = `
      <div class="ctx-title">Belt <span class="badge idle">${DIR_ARROW[b.dir]} ${DIR_NAME[b.dir]}</span></div>
      <div class="ctx-sub">Moves one item per second when the next tile has room.</div>`;
    if (item) {
      const fresh = item.type === 'tub' && item.fresh != null
        ? `<span class="fresh ${item.fresh < SIM.coldWarnTicks ? 'low' : ''}">${fmtChill(item.fresh)} chill</span>`
        : item.type === 'melted'
          ? `<span class="fresh low">clears in ${fmtChill(item.melt ?? SIM.meltAutoDiscardTicks)}</span>`
          : '';
      html += `<div class="item-row">${itemIcon(item.type, ITEMS)}<span class="nm">${escapeHtml(itemName(item.type))}</span>${fresh}</div>`;
      if (item.blocked && item.blockedReason) {
        html += `<div class="note-line warn">Blocked: ${escapeHtml(item.blockedReason)}</div>`;
      }
    } else {
      html += `<div class="note-line">Empty. A belt only moves when the next tile or socket has room.</div>`;
    }
    html += `<div class="ctx-actions">
      <button class="btn btn-sm" data-act="rotate-belt">${icon('rotate')} ${DIR_ARROW[(b.dir + 1) % 4]}</button>
      ${item ? `<button class="btn btn-sm btn-danger" data-act="remove-item">${icon('trash')} Remove item</button>` : ''}
      ${b.preplaced
        ? '<span class="note-line" style="flex:1 1 100%;margin:0">Fixed part of this workshop. It can be rotated but not sold.</span>'
        : `<button class="btn btn-sm" data-act="sell-belt">Sell · ${refundFor('belt')}</button>`}
    </div>`;
    return html;
  }

  objectContext(s, o) {
    const def = BUILDINGS[o.type];
    const kind = def.kind;
    let html = '';
    const stateLabel = kind === 'machine'
      ? ({ working: 'working', blocked: 'blocked', idle: 'idle' })[o.state] || 'idle'
      : kind === 'counter' ? 'serving' : 'growing';
    const stateClass = kind === 'machine' ? o.state : 'idle';
    html += `<div class="ctx-title">${escapeHtml(def.name)} <span class="badge ${stateClass}">${stateLabel}</span></div>
      <div class="ctx-sub">${escapeHtml(def.desc)}</div>`;

    if (kind === 'source') {
      for (const lane of o.lanes) {
        const every = lane.manual ? 'by hand' : `${Math.round(lane.every / 10)}s`;
        html += `<div class="item-row">${itemIcon(lane.item, ITEMS)}<span class="nm">${escapeHtml(itemName(lane.item))}</span><span class="fresh">${lane.buf.length}/${lane.buffer} · ${every}</span></div>`;
      }
      if (o.type === 'dairyCrate') {
        const left = this.ctrl.level.creamCap - s.creamBought;
        let note = `Cream is never automatic. Buy one for ${SIM.creamPrice} coins. ${left} left this level.`;
        if (left <= 0) note = `No cream buys left this level. Each ice cream needs one, so no more tubs can be made. Restart the level from the pause menu to get the budget back.`;
        else if (left <= 2) note = `Only ${left} cream buys left. Each ice cream needs one, so a wrong buy can cost you the tub orders.`;
        const poor = s.coins < SIM.creamPrice;
        html += `<div class="note-line${left <= 2 || (poor && left > 0) ? ' warn' : ''}">${note}${left > 0 && poor ? ` Not enough coins: you have ${s.coins}, cream costs ${SIM.creamPrice}.` : ''}</div>
          <div class="ctx-actions">
            <button class="btn btn-sm btn-primary" data-act="buy-cream" ${left <= 0 || poor ? 'disabled' : ''}>Buy cream · ${SIM.creamPrice}</button>
          </div>`;
      }
    } else if (kind === 'machine') {
      for (let i = 0; i < o.inputs.length; i++) {
        const sock = o.inputs[i];
        const fam = FAMILIES[sock.family];
        const dots = [0, 1].map(k => {
          const it = sock.buf[k];
          return `<i class="${it ? 'on' : ''}" title="${it ? escapeHtml(itemName(it.type)) : 'Empty'}">${it ? itemIcon(it.type, ITEMS) : ''}</i>`;
        }).join('');
        const need = !sock.buf.length && o.state === 'idle'
          ? `<span class="need">needs ${escapeHtml((fam.label || 'input').toLowerCase())}</span>`
          : `<span class="buf">${dots}</span>`;
        html += `<div class="socket"><span class="lbl">${sock.label || ''}</span>
          ${itemIcon(sock.buf.length ? sock.buf[0].type : fam.accepts[0], ITEMS)}
          <span>${escapeHtml(fam.label)}<br><span style="font-size:11px;color:var(--ink-soft)">from ${DIR_NAME[socketEdge(o, i)]}</span></span>
          ${need}</div>`;
        if (o.type === 'freezer') {
          sock.buf.forEach((it, itemIndex) => {
            if (it.type !== 'melted' || (it.refreezeCount || 0) < SIM.maxRefreezeCycles) return;
            html += `<div class="item-row">${itemIcon(it.type, ITEMS)}<span class="nm">Refreeze limit reached</span>
              <button class="btn btn-sm btn-quiet" data-act="discard-machine-input" data-object="${o.id}" data-socket="${i}" data-index="${itemIndex}">Remove</button></div>`;
          });
        }
      }
      if (o.recipe) {
        const rec = RECIPES.find(r => r.id === o.recipe);
        const pct = Math.round((o.progress / Math.max(1, o.recipeTicks)) * 100);
        html += `<div class="progress-row"><span>${o.state === 'blocked' ? 'Blocked' : 'Making'}</span>
          <div class="progress-bar"><i style="width:${pct}%"></i></div>
          <span>${rec ? Math.ceil((o.recipeTicks - o.progress) / 10) : 0}s</span></div>`;
        if (rec) html += `<div class="kv"><dt>Recipe</dt><dd>${escapeHtml(itemName(rec.inputs.join(' + ')))} → ${escapeHtml(itemName(rec.out))}</dd></div>`;
      } else if (o.reason) {
        html += `<div class="note-line warn">${escapeHtml(o.reason)}</div>`;
      }
      const outName = o.type === 'freezer'
        ? `${o.output.length} / ${o.outCap} tubs · chilled`
        : `${o.output.length} / ${o.outCap} items`;
      html += `<div class="kv"><dt>Output</dt><dd>${outName}</dd></div>`;
      if (o.type === 'freezer') {
        html += `<div class="note-line">Tubs are safe inside the freezer. Freshness starts on a belt: 45 s, even while blocked. Melted Mix can be refrozen twice; each cycle leaves less time.</div>`;
      }

      const speedMax = UPGRADES.speed.max;
      if (o.speedLvl < speedMax) {
        const cost = UPGRADES.speed.costs[o.speedLvl];
        html += `<div class="kv"><dt>Speed</dt><dd>Lv ${o.speedLvl} / ${speedMax}</dd></div>
          <div class="ctx-actions"><button class="btn btn-sm" data-act="up-speed" ${s.coins < cost ? 'disabled' : ''}>Upgrade speed · ${cost}</button></div>`;
      } else {
        html += `<div class="kv"><dt>Speed</dt><dd>Fully upgraded</dd></div>`;
      }
      if (o.type === 'freezer') {
        if (o.coolingLvl < UPGRADES.cooling.max) {
          const cost = UPGRADES.cooling.costs[0];
          html += `<div class="ctx-actions"><button class="btn btn-sm" data-act="up-cooling" ${s.coins < cost ? 'disabled' : ''}>${icon('snow')} Cooling · ${cost}</button></div>`;
        } else {
          html += `<div class="kv"><dt>Cooling</dt><dd>Lv 1 · 8 tubs</dd></div>`;
        }
      }
    } else if (kind === 'counter') {
      const buf = o.inputs[0].buf;
      const unwanted = buf.filter(it => !findOrderFor(s, it.type));
      if (o.note) html += `<div class="note-line warn">${escapeHtml(o.note)}</div>`;
      if (!buf.length) {
        html += `<div class="note-line">Chilled buffer 0 / ${o.outCap}. Items wait here without aging and are served automatically when an order matches.</div>`;
      } else {
        html += `<div class="note-line good">Chilled buffer · items do not age here.</div>`;
        buf.forEach((it, i) => {
          const bad = !findOrderFor(s, it.type);
          html += `<div class="item-row">${itemIcon(it.type, ITEMS)}<span class="nm">${escapeHtml(itemName(it.type))}</span>
            <span class="fresh ${bad ? 'low' : 'chilled'}">${bad ? 'no order wants this' : 'chilled'}</span>
            <button class="btn btn-sm btn-quiet" data-act="discard-item" data-index="${i}">Discard</button></div>`;
        });
        if (unwanted.length) {
          html += `<div class="note-line warn">The counter takes nothing new while it holds an unwanted item, so the belt behind it is backed up. Discard it above to clear the line.</div>`;
        }
      }
      html += `<div class="kv"><dt>Buffer</dt><dd>${buf.length} / ${o.outCap}</dd></div>`;
    }

    const canEdit = !o.fixed;
    html += `<div class="ctx-actions">`;
    if (!canEdit) {
      html += `<span class="note-line" style="flex:1 1 100%;margin:0">Fixed part of this workshop — it cannot be moved or sold.</span>`;
    } else {
      if (def.rotatable || kind === 'machine' || kind === 'counter') {
        html += `<button class="btn btn-sm" data-act="rotate-object">${icon('rotate')} Rotate · ${DIR_ARROW[o.rot]}</button>`;
      }
      html += `<button class="btn btn-sm" data-act="move-object">${icon('move')} Move</button>`;
      html += `<button class="btn btn-sm btn-danger" data-act="sell-object">Sell · ${refundFor(o.type)}</button>`;
    }
    html += `</div>`;
    return html;
  }

  // ---------------------------------------------------------------- shortage aids

  jumpLabel(jump) {
    if (!jump) return '';
    if (jump.kind === 'build') return `Build a ${jump.label}`;
    if (jump.kind === 'belt') return 'Follow this belt';
    const o = this.ctrl.s && this.ctrl.s.objects.find(x => x.id === jump.id);
    return o ? `Go to the ${BUILDINGS[o.type].name}` : '';
  }

  stallFooter() {
    const stall = this.ctrl.stall;
    if (!stall || !stall.tiles.length || !stall.note) return '';
    const label = this.jumpLabel(stall.jump);
    return `<div class="stall-line ${stall.tone}">${escapeHtml(stall.note)}${
      label ? `<button class="btn btn-sm btn-quiet" data-act="jump-stall">${icon('arrow')} ${escapeHtml(label)}</button>` : ''
    }</div>`;
  }

  // An item already on a belt, in a socket, or waiting at the counter is not a shortage.
  inTransit(s, type) {
    for (const b of Object.values(s.belts)) {
      if (b.item && b.item.type === type) return true;
    }
    for (const o of s.objects) {
      if ((o.output || []).some(it => it.type === type)) return true;
      for (const sock of o.inputs || []) if (sock.buf.some(it => it.type === type)) return true;
      for (const lane of o.lanes || []) if (lane.buf.some(it => it.type === type)) return true;
    }
    return false;
  }

  shortageChip(s, type) {
    if (this.inTransit(s, type)) return '';
    const sup = supplierFor(s, type);
    const label = sup ? this.jumpLabel(sup) : `Nothing here makes ${itemName(type)}`;
    return `<button class="btn btn-sm btn-quiet" data-act="jump-supplier" data-type="${escapeHtml(type)}">${icon('arrow')} ${escapeHtml(label)}</button>`;
  }

  // ---------------------------------------------------------------- tutorial

  renderTutorial() {
    const st = this.ctrl.tutorialState();
    const settings = this.ctrl.settings;
    const dismissed = !!this.ctrl.s?.hintDismissed;
    // "Dismissible" only means something if the player can undo it (PRD §6.9).
    this.el.tutRestore.hidden = !(st && settings.hints && dismissed && !st.done);
    // This must run even when the strip is hidden, or the last step's hint
    // tiles stay painted after the tutorial finishes.
    if (st) {
      const key = `${st.index}:${st.done}`;
      if (key !== this.lastTutorialKey) {
        this.lastTutorialKey = key;
        this.ctrl.onTutorialStep(st);
      }
    }
    if (!st || !settings.hints || dismissed || st.done) {
      this.el.tutorial.hidden = true;
      return;
    }
    this.el.tutorial.hidden = false;
    this.el.tutStep.textContent = `Step ${st.index + 1} of ${st.total}`;
    this.el.tutText.innerHTML = st.step.text;
  }

  // ---------------------------------------------------------------- live refresh

  refresh() {
    const ctrl = this.ctrl;
    const s = ctrl.s;
    if (!s || !ctrl.level) return;
    const level = ctrl.level;
    const t = this.el.topbar;

    t.querySelector('[data-el="chapter"]').textContent = `${levelNumberLabel(level)} · ${level.name}`;
    const objEl = t.querySelector('[data-el="objective"]');
    t.querySelector('[data-el="townbtn"]').style.display = level.town ? '' : 'none';
    if (level.town) {
      const st = storyStatus(ensureTown(ctrl.doc.profile));
      objEl.innerHTML = st.done || st.locked
        ? escapeHtml(st.text)
        : `${escapeHtml(st.title)}: ${escapeHtml(st.text)} <span class="p">${st.have}/${st.need}</span>`;
    } else {
      const prog = primaryProgress(level, s);
      objEl.innerHTML = `${escapeHtml(level.objective.text)} <span class="p">${prog.done}/${prog.total}${prog.extra ? ' · ' + escapeHtml(prog.extra) : ''}</span>`;
    }
    t.querySelector('[data-el="coins"]').textContent = s.coins;
    t.querySelector('[data-el="rep"]').textContent = s.reputation;
    const profile = ensureTown(ctrl.doc?.profile);
    if (profile) {
      t.querySelector('[data-el="town"]').textContent = profile.townLevel;
      const need = xpToNext(profile.townLevel);
      const maxed = profile.townLevel >= MAX_TOWN_LEVEL;
      t.querySelector('[data-el="xp"]').textContent = maxed ? 'max' : `${profile.xp}/${need} xp`;
      t.querySelector('[data-el="townchip"]').title = maxed ? 'Town Level maxed' : `Town Level ${profile.townLevel}: ${need - profile.xp} xp to the next level`;
    }

    const pauseBtn = t.querySelector('[data-act="pause"]');
    pauseBtn.innerHTML = s.paused ? icon('play') : icon('pause');
    pauseBtn.setAttribute('aria-label', s.paused ? 'Resume game' : 'Pause game');

    const speedBtn = t.querySelector('[data-act="speed"]');
    speedBtn.textContent = `${ctrl.speed}×`;
    speedBtn.setAttribute('aria-label', `Simulation speed ${ctrl.speed}×`);
    speedBtn.classList.toggle('active', ctrl.speed > 1);

    this.renderOrders();
    this.renderContext();
    this.renderTutorial();
    this.refreshBuildAffordability();
  }

  setSaveState(text, busy = false) {
    setSaveStatus(text, busy);
  }

  setCameraYaw(degrees) {
    const heading = ((degrees % 360) + 360) % 360;
    const sliderHeading = Math.min(359.9, Math.round(heading * 10) / 10);
    const rounded = Math.round(heading) % 360;
    const compassPoint = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8];
    if (this.el.orbitRange) this.el.orbitRange.value = String(sliderHeading);
    if (this.el.orbitValue) this.el.orbitValue.textContent = `${compassPoint} ${String(rounded).padStart(3, '0')}°`;
    if (this.el.orbitCompass) this.el.orbitCompass.style.setProperty('--needle-angle', `${-heading}deg`);
  }

  showComplete(data) {
    const level = this.ctrl.level;
    const seconds = this.ctrl.s.trackers.elapsedTicks / 10;
    renderCompleteBanner(this.ui, {
      level,
      coins: this.ctrl.s.coins,
      reputation: this.ctrl.s.reputation,
      seconds,
      optional: level.optional,
      earned: data.earned || [],
      hasNext: !!level.unlockNext,
    });
  }

  // ---------------------------------------------------------------- sheets

  toggleSheet(name) {
    if (this.sheetName === name) this.closeSheet();
    else this.openSheet(name);
  }

  openSheet(name) {
    const entry = this.el.sheets[name];
    if (!entry) return;
    if (this.sheetName) this.closeSheet();
    entry.parent = entry.panel.parentElement;
    entry.next = entry.panel.nextSibling;
    entry.panel.style.position = 'static';
    entry.panel.style.width = '100%';
    entry.panel.style.maxHeight = 'none';
    entry.panel.style.display = 'flex';
    entry.body.appendChild(entry.panel);
    entry.sheet.classList.add('open');
    entry.sheet.querySelector('.panel-body').style.maxHeight = 'none';
    this.sheetName = name;
    this.el.scrim.style.display = 'block';
    setTimeout(() => entry.sheet.querySelector('[data-act="close-sheet"]')?.focus(), 20);
  }

  closeSheet() {
    if (!this.sheetName) return;
    const entry = this.el.sheets[this.sheetName];
    if (entry && entry.parent) {
      for (const key of ['position', 'width', 'maxHeight', 'display']) entry.panel.style[key] = '';
      const body = entry.panel.querySelector('.panel-body');
      if (body) body.style.maxHeight = '';
      if (entry.next && entry.next.parentElement === entry.parent) entry.parent.insertBefore(entry.panel, entry.next);
      else entry.parent.appendChild(entry.panel);
    }
    if (entry) entry.sheet.classList.remove('open');
    this.el.scrim.style.display = 'none';
    this.sheetName = null;
  }

  anySheetOpen() {
    return !!this.sheetName;
  }

  destroy() {
    this.closeSheet();
    this.stopPan();
    this.ui.removeEventListener('click', this.onClick);
    this.ui.removeEventListener('input', this.onOrbitInput);
    this.ui.removeEventListener('pointerdown', this.onPointerDown);
    this.ui.removeEventListener('pointerup', this.onPointerStop);
    this.ui.removeEventListener('pointercancel', this.onPointerStop);
    this.ui.removeEventListener('pointerleave', this.onPointerStop);
    this.ui.querySelectorAll('[data-layer="hud"]').forEach(el => el.remove());
    this.ui.querySelectorAll('.complete-banner').forEach(el => el.remove());
  }
}
