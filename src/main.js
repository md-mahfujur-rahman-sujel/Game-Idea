import { WorkshopScene3D } from './render/scene3d.js';
import { LEVEL_BY_ID, isBuildable } from './data/levels.js';
import { BUILDINGS, SIM } from './data/buildings.js';
import { ITEMS } from './data/items.js';
import {
  createLevelState, validatePlacement, placeObject, placeBelt, sellObject, sellBelt,
  buyCream as buyCreamState, upgradeSpeed as upgradeSpeedState,
  upgradeCooling as upgradeCoolingState, refundFor, objectAt, beltAt,
  sanitizeState, stallReport, supplierFor, contentsOf,
} from './core/state.js';
import { step, sendErrand as sendErrandSim, removeBeltItem, discardCounterItem as discardCounterItemSim, discardMachineInputItem } from './core/sim.js';
import { primaryProgress } from './core/objectives.js';
import { DIR_VEC, opp, edgeTiles, tileOnEdge, EDGE_DIR } from './core/iso.js';
import { SaveStore, freshDoc, DEFAULT_SETTINGS } from './core/save.js';
import {
  addXp, orderXp, ensureTown, recordOrder, boardSlots, isBuildingUnlocked, buildingUnlockLevel,
  SPEED_UPGRADE_LEVEL, EXPANSIONS, canExpand, advanceStory, ensureDaily, claimDaily, claimChest, overnightBatch,
} from './core/town.js';
import { openTownDialog } from './ui/town.js';
import { AudioBus } from './core/audio.js';
import { renderMainMenu, renderLevelSelect, openSettings, openHowTo, levelNumberLabel } from './ui/menu.js';
import { HUD } from './ui/hud.js';
import { openReport } from './ui/report.js';
import { toast, openDialog, confirmAction, clearToasts } from './ui/dom.js';

class Controller {
  constructor() {
    this.store = new SaveStore();
    this.audio = new AudioBus();
    this.doc = null;
    this.level = null;
    this.s = null;
    this.scene = null;
    this.game = null;
    this.hud = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.selection = null;
    this.buildType = null;
    this.buildRot = 0;
    this.moveId = null;
    this.autoPaused = false;
    this.hoverTile = null;
    this.stall = null;
    this.speed = 1;
    this.acc = 0;
    this.hudClock = 0;
    this.saveClock = 0;
    this.saving = false;
    this.saveQueued = false;
    this.saveTimer = null;
    this.canSave = false;
    this.sceneReady = false;
    this.scenePromise = null;
    this.fx = {
      sfx: (name) => this.audio.cue(name),
      toast: (title, sub = '', kind = 'info') => toast(title, sub, kind === 'warn' ? 'warn' : kind === 'good' ? 'good' : 'info'),
      onSave: () => this.saveSoon(),
      onComplete: () => this.onLevelComplete(),
      onOrder: (order) => this.awardXp(order),
    };
  }

  async boot() {
    await this.store.init();
    const res = await this.store.load();
    if (res.status === 'corrupt') {
      this.doc = freshDoc();
      this.settings = { ...DEFAULT_SETTINGS };
      this.applySettings(true);
      this.showMainMenu();
      openDialog({
        title: 'That save could not be read',
        body: '<p>The current save and every available local recovery copy failed validation. Nothing has been deleted.</p><p>Export the damaged copies for safekeeping, or explicitly start a fresh workshop. Progress cannot be restored if every local copy is damaged or has been erased.</p>',
        dismissible: false,
        actions: [
          {
            label: 'Export damaged save', kind: 'quiet', keepOpen: true,
            onClick: () => {
              if (!this.store.downloadDamaged(res.damaged)) toast('Export unavailable', 'This browser could not download the damaged save copies.', 'warn');
            },
          },
          {
            label: 'Start fresh', kind: 'primary', autofocus: true,
            onClick: async () => {
              try { await this.store.clear(); } catch { /* ignore */ }
              this.doc = freshDoc();
              this.settings = { ...DEFAULT_SETTINGS };
              this.canSave = true;
              this.applySettings(true);
              this.showMainMenu();
            },
          },
        ],
      });
    } else {
      this.doc = res.status === 'empty' ? freshDoc() : res.doc;
      this.settings = { ...DEFAULT_SETTINGS, ...(this.doc.profile.settings || {}) };
      this.canSave = true;
      this.repairTownUnlock();
      this.applySettings(true);
      this.showMainMenu();
      if (res.status === 'backup' || res.status === 'daily' || res.status === 'mirror') {
        const message = res.status === 'daily'
          ? 'The latest save was unreadable, so the daily recovery copy was restored.'
          : res.status === 'mirror'
            ? 'The save was restored from the local fallback copy.'
            : 'The newest save was unreadable, so the previous good copy was restored.';
        toast('Restored a recovery save', message, 'good');
        this.store.save(this.doc).catch(() => {});
      }
    }
    this.installInput();
    this.installLifecycle();
  }

  // -------------------------------------------------------------- rendering boot

  ensureGame() {
    if (this.sceneReady) return Promise.resolve(this.scene);
    if (this.scenePromise) return this.scenePromise;
    this.scenePromise = new Promise((resolve, reject) => {
      this.resolveScene = resolve;
      try {
        this.game = new WorkshopScene3D(this);
      } catch (err) {
        reject(err);
      }
    });
    return this.scenePromise;
  }

  onSceneReady(scene) {
    this.scene = scene;
    this.sceneReady = true;
    if (this.resolveScene) this.resolveScene(scene);
  }

  showGameUi() {
    this.ui().querySelectorAll('[data-layer="screen"]').forEach(el => el.remove());
    clearToasts();
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
    this.hud = new HUD(this);
    this.hud.renderBuild();
    this.hud.refresh();
  }

  async startLevel(id, opts = {}) {
    let level = LEVEL_BY_ID[id];
    if (level && level.town && this.doc) level = this.townLevelFor();
    if (!level) return;
    // The debug controller is reachable before boot finishes; ignore the call
    // rather than dereferencing a document that does not exist yet.
    if (!this.doc) return;
    this.level = level;
    const resume = opts.resume !== false && this.doc.level?.levelId === id;
    let state = null;
    if (resume) state = sanitizeState(this.doc.level.state, level);
    if (!state) state = createLevelState(level);
    state.paused = false;
    state.levelDone = !!state.trackers.completed;
    if (level.town) this.prepareTown(state, resume);

    this.s = state;
    this.selection = null;
    this.buildType = null;
    this.moveId = null;
    this.autoPaused = false;
    this.hoverTile = null;
    this.stall = null;
    this.speed = 1;
    this.acc = 0;
    this.hudClock = 0;
    this.saveClock = 0;
    this.doc.level = { levelId: id, state: this.serializeState() };

    this.showGameUi();
    document.title = `Little Batch Works — ${levelNumberLabel(level)}`;

    try {
      await this.ensureGame();
    } catch (err) {
      this.hud?.destroy();
      this.hud = null;
      this.s = null;
      this.level = null;
      this.showMainMenu();
      openDialog({
        title: 'Graphics could not start',
        body: '<p>This build draws the workshop with WebGL. Your browser or device did not provide a WebGL context.</p><p>Try a current version of Chrome, Edge, Firefox, or Safari, with hardware acceleration enabled.</p>',
        dismissible: false,
        actions: [{ label: 'Back to menu', kind: 'primary', autofocus: true }],
      });
      return;
    }

    const scene = this.scene;
    scene.setSettings(this.settings);
    scene.landmarkStage = level.town ? Math.min(5, ensureTown(this.doc.profile).landmark) : 0;
    scene.setLevel(level);
    scene.setState(state);
    scene.setSelection(null);
    scene.setBuild(null);
    scene.setHints([]);
    scene.setPath([], '');
    scene.refreshAll();
    this.hud.lastTutorialKey = '';
    this.hud.renderBuild();
    this.hud.setBuildMode(null, 0);
    this.hud.refresh();
    if (!resume && window.matchMedia('(max-height: 520px), (max-width: 800px)').matches) {
      this.hud.toggleSheet('build');
    }
    this.saveNow();

    if (state.trackers.completed) {
      setTimeout(() => {
        if (this.hud && this.s === state) this.hud.showComplete({ earned: state.trackers.optionalEarned });
      }, 500);
    }
  }

  // -------------------------------------------------------------- screens

  ui() {
    return document.getElementById('ui');
  }

  menuCtx() {
    return {
      doc: this.doc,
      onContinue: () => this.continueGame(),
      onNew: () => this.newGame(),
      onLevels: () => this.showLevelSelect(),
      onBack: () => this.showMainMenu(),
      onLevel: (id) => this.pickLevel(id),
      onSettings: () => this.openSettings(),
      onSetting: (key, value) => this.setSetting(key, value),
      onReset: () => this.resetProgress(),
      settings: this.settings,
    };
  }

  showMainMenu() {
    this.saveNow();
    this.teardownLevel();
    this.ui().querySelectorAll('[data-layer="screen"]').forEach(el => el.remove());
    renderMainMenu(this.ui(), this.menuCtx());
    document.title = 'Little Batch Works';
  }

  showLevelSelect() {
    this.saveNow();
    this.teardownLevel();
    this.ui().querySelectorAll('[data-layer="screen"]').forEach(el => el.remove());
    renderLevelSelect(this.ui(), this.menuCtx());
  }

  teardownLevel() {
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
    clearToasts();
    this.s = null;
    this.level = null;
    this.selection = null;
    this.buildType = null;
    this.moveId = null;
    this.autoPaused = false;
  }

  continueGame() {
    if (!this.doc.level) return;
    this.startLevel(this.doc.level.levelId, { resume: true });
  }

  newGame() {
    const begin = async () => {
      const keptSettings = { ...this.settings };
      this.doc = freshDoc();
      this.doc.profile.settings = { ...keptSettings };
      this.settings = keptSettings;
      this.canSave = true;
      this.applySettings(true);
      this.showLevelSelect();
      await this.saveNow();
      this.startLevel('tutorial', { resume: false });
    };
    if (this.doc.level) {
      confirmAction({
        title: 'Start a new workshop?',
        message: 'This clears the saved workshop, unlocked levels, and optional badges on this device. Settings are kept.',
        confirmLabel: 'Start fresh',
        danger: true,
      }).then(ok => { if (ok) begin(); });
    } else {
      begin();
    }
  }

  pickLevel(id) {
    const cur = this.doc.level;
    if (cur && cur.levelId !== id && !(cur.state && cur.state.trackers && cur.state.trackers.completed)) {
      const leaving = LEVEL_BY_ID[cur.levelId];
      confirmAction({
        title: 'Leave this level?',
        message: `<b>${escapeText(leaving ? leaving.name : 'This level')}</b> is still in progress. Starting another level discards its layout, coins and cream buys.`,
        confirmLabel: 'Discard and start',
        danger: true,
      }).then(ok => { if (ok) this.startLevel(id, { resume: true }); });
      return;
    }
    this.startLevel(id, { resume: true });
  }

  resetProgress() {
    if (!this.doc) return;
    const body = document.createElement('div');
    body.innerHTML = `
      <p>This deletes the saved workshop, unlocked levels, completed badges, and settings on this device. It cannot be undone.</p>
      <p>Type <b>RESET</b> to confirm.</p>
      <label class="sr-only" for="reset-word">Type RESET to confirm</label>
      <input id="reset-word" type="text" autocomplete="off" spellcheck="false" placeholder="RESET">`;
    const input = body.querySelector('input');
    const dlg = openDialog({
      title: 'Reset all progress?',
      body,
      dismissible: true,
      actions: [
        { label: 'Cancel', kind: 'quiet' },
        {
          label: 'Delete everything', kind: 'danger', keepOpen: true,
          onClick: async () => {
            if ((input.value || '').trim().toUpperCase() !== 'RESET') {
              toast('Not confirmed', 'Type RESET exactly to delete the save.', 'warn');
              input.focus();
              return;
            }
            try { await this.store.clear(); } catch { /* ignore */ }
            this.doc = freshDoc();
            this.settings = { ...DEFAULT_SETTINGS };
            this.canSave = true;
            this.applySettings(true);
            dlg.close(true);
            this.showMainMenu();
            toast('Progress reset', 'The workshop is back to a fresh start.', 'good');
          },
        },
      ],
    });
    setTimeout(() => input.focus(), 30);
  }

  exitToMenu() {
    this.saveNow().then(() => this.showMainMenu());
  }

  // -------------------------------------------------------------- settings

  applySettings(initial = false) {
    document.body.classList.toggle('reduce-motion', !!this.settings.reducedMotion);
    this.audio.applySettings(this.settings);
    if (this.scene) this.scene.setSettings(this.settings);
    if (!initial && this.hud) this.hud.refresh();
  }

  setSetting(key, value) {
    this.settings[key] = value;
    if (key === 'hints' && value && this.s) {
      this.s.hintDismissed = false;
      this.hud && (this.hud.lastTutorialKey = '');
    }
    this.doc.profile.settings = { ...this.settings };
    this.applySettings();
    this.saveSoon();
  }

  openSettings() {
    if (!this.doc) return;
    if (document.querySelector('.backdrop')) return;
    let resume = false;
    if (this.s && !this.s.paused) {
      this.s.paused = true;
      resume = true;
      this.hud?.refresh();
    }
    const dlg = openSettings({
      settings: this.settings,
      onSetting: (key, value) => this.setSetting(key, value),
    });
    if (dlg && dlg.onClose) {
      dlg.onClose(() => {
        if (resume && this.s) {
          this.s.paused = false;
          this.hud?.refresh();
        }
      });
    }
  }

  // The report pauses the line so a bottleneck cannot clear while the player
  // reads it. openReport resumes only if it was the one that paused.
  openWorkshopReport() {
    if (!this.s || document.querySelector('.backdrop')) return;
    openReport(this);
  }

  // -------------------------------------------------------------- simulation loop

  tick(delta) {
    if (!this.s) return;
    const d = Math.min(delta || 16.7, 250);
    if (!this.s.paused && !this.s.levelDone) {
      this.acc += d * this.speed;
      let guard = 0;
      while (this.acc >= SIM.tickMs && guard < 40) {
        this.acc -= SIM.tickMs;
        step(this.s, this.level, this.fx);
        guard++;
        if (this.s.levelDone) {
          this.acc = 0;
          break;
        }
      }
    } else {
      this.acc = 0;
    }

    this.hudClock += d;
    if (this.hudClock >= 240) {
      this.hudClock = 0;
      if (this.scene) {
        this.scene.refreshBuffers();
        this.scene.refreshCustomers();
      }
      if (this.level?.town) this.updateTown();
      this.updateStallPath();
      this.hud?.refresh();
    }

    this.saveClock += d;
    if (this.saveClock >= 6000) {
      this.saveClock = 0;
      this.saveNow();
    }
  }

  togglePause() {
    if (!this.s || this.s.levelDone) return;
    this.s.paused = !this.s.paused;
    this.autoPaused = false;
    this.hud?.refresh();
  }

  cycleSpeed() {
    // PRD FR-21 ships 1x and 2x only; faster was gated on staying readable.
    this.speed = this.speed === 1 ? 2 : 1;
    this.hud?.refresh();
  }

  // Town Level (PRD 6.8a). Every served order earns XP; a level-up pays a small coin gift
  // into the current level and always says what changed.
  awardXp(order) {
    const profile = this.doc?.profile;
    if (!profile) return;
    recordOrder(profile, order);
    this.grantXp(orderXp(order));
    this.hud?.refresh();
  }

  grantXp(amount) {
    const profile = this.doc?.profile;
    if (!profile) return;
    const res = addXp(profile, amount);
    if (res.levelsGained > 0) {
      const gift = res.level * 5;
      if (this.s) {
        this.s.coins += gift;
        this.s.townLevel = res.level;
        this.s.boardSlots = boardSlots(res.level);
      }
      this.audio.cue('unlock');
      const extra = res.unlocked.length ? ` Unlocked: ${res.unlocked.join(', ')}.` : '';
      toast(`Town Level ${res.level}`, `+${gift} coins for growing the town.${extra}`, 'good');
      this.hud?.renderBuild();
      this.saveSoon();
    }
  }

  // ---- Town mode (PRD 6.8a)

  townLevelFor() {
    const profile = ensureTown(this.doc.profile);
    const tier = EXPANSIONS[profile.expansion] || EXPANSIONS[0];
    return { ...LEVEL_BY_ID.town, x1: tier.x1, y1: tier.y1 };
  }

  prepareTown(state, resume) {
    const profile = ensureTown(this.doc.profile);
    state.townLevel = profile.townLevel;
    state.boardSlots = boardSlots(profile.townLevel);
    ensureDaily(profile);
    if (resume) {
      const batch = overnightBatch(profile);
      if (batch) {
        state.coins += batch.coins;
        this.grantXp(batch.xp);
        toast('Overnight batch', `While you were away (${batch.minutes} min) the workshop earned ${batch.coins} coins and ${batch.xp} xp.`, 'good');
      }
    }
    state.townLevel = profile.townLevel;
    state.boardSlots = boardSlots(profile.townLevel);
    profile.lastSeenAt = Date.now();
  }

  updateTown() {
    const profile = this.doc?.profile;
    if (!profile || !this.s) return;
    ensureTown(profile);
    if (ensureDaily(profile)) toast('New daily goals', 'Fresh goals are ready in the Town panel.', 'info');
    for (const ev of advanceStory(profile)) {
      if (ev.kind === 'intro') {
        toast(ev.chapter.title, ev.chapter.intro, 'info');
      } else if (ev.kind === 'step') {
        this.s.coins += ev.coins;
        toast('Story step complete', `${ev.step.text} · +${ev.coins} coins`, 'good');
        this.grantXp(ev.xp);
        this.saveSoon();
      } else if (ev.kind === 'chapter') {
        this.audio.cue('unlock');
        this.scene?.setLandmarkStage(profile.landmark);
        toast(`Chapter complete: ${ev.chapter.title}`, 'The landmark grows a stage. +1 Expansion Permit.', 'good');
        this.saveSoon();
      }
    }
  }

  openTown() {
    if (!this.s || !this.level?.town || document.querySelector('.backdrop')) return;
    let resume = false;
    if (!this.s.paused) {
      this.s.paused = true;
      resume = true;
      this.hud?.refresh();
    }
    const dlg = openTownDialog(this);
    if (dlg && dlg.onClose) {
      dlg.onClose(() => {
        if (resume && this.s) {
          this.s.paused = false;
          this.hud?.refresh();
        }
      });
    }
  }

  claimDailyGoal(index) {
    const profile = this.doc?.profile;
    const r = profile && claimDaily(profile, index);
    if (!r || !this.s) return;
    this.s.coins += r.coins;
    this.audio.cue('order');
    toast('Daily goal claimed', `+${r.coins} coins · +${r.xp} xp`, 'good');
    this.grantXp(r.xp);
    this.hud?.refresh();
    this.saveSoon();
  }

  claimDailyChest() {
    const profile = this.doc?.profile;
    const r = profile && claimChest(profile);
    if (!r || !this.s) return;
    this.s.coins += r.coins;
    this.audio.cue('unlock');
    toast('Daily gift', `+${r.coins} coins${r.permits ? ' · +1 Expansion Permit' : ''}`, 'good');
    this.hud?.refresh();
    this.saveSoon();
  }

  expandTown() {
    const profile = this.doc?.profile;
    if (!profile || !this.s || !this.scene) return;
    const check = canExpand(profile, this.s.coins);
    if (!check.ok) {
      toast('Cannot expand yet', check.reason, 'warn');
      return;
    }
    this.s.coins -= check.next.coins;
    profile.permits -= check.next.permits;
    profile.expansion += 1;
    this.level = this.townLevelFor();
    this.scene.setLevel(this.level);
    this.scene.setState(this.s);
    this.scene.refreshAll();
    this.audio.cue('unlock');
    toast('The town grew', `${check.next.name} is open for building.`, 'good');
    this.hud?.refresh();
    this.saveSoon();
  }

  // Saves from before Town mode existed: finishing Level 3 should have unlocked it.
  repairTownUnlock() {
    const p = this.doc?.profile;
    if (p?.completed?.level3 && Array.isArray(p.unlocked) && !p.unlocked.includes('town')) p.unlocked.push('town');
  }

  onLevelComplete() {
    const level = this.level;
    if (!level) return;
    const rec = {
      // Keep every badge ever earned on this level; a weaker replay must not erase them.
      optional: [...new Set([
        ...(this.doc.profile.completed[level.id]?.optional || []),
        ...this.s.trackers.optionalEarned,
      ])],
      fulfilled: this.s.counters.fulfilled,
      coins: this.s.coins,
      reputation: this.s.reputation,
      elapsedTicks: this.s.trackers.elapsedTicks,
      at: Date.now(),
    };
    this.doc.profile.completed[level.id] = rec;
    if (level.unlockNext && !this.doc.profile.unlocked.includes(level.unlockNext)) {
      this.doc.profile.unlocked.push(level.unlockNext);
    }
    this.audio.cue('unlock');
    this.autoPaused = false;
    this.saveNow();
    this.hud?.refresh();
    setTimeout(() => {
      if (this.hud && this.s && this.s.trackers.completed) {
        this.hud.showComplete({ earned: rec.optional });
      }
    }, 700);
  }

  handleCompleteAction(act) {
    if (!this.level) return;
    if (act === 'next' && this.level.unlockNext) this.startLevel(this.level.unlockNext, { resume: false });
    else if (act === 'replay') this.startLevel(this.level.id, { resume: false });
    else if (act === 'levels') this.showLevelSelect();
  }

  // -------------------------------------------------------------- world input

  onClick(tile) {
    if (!tile || !this.s) return;
    if (this.buildType) {
      this.tryPlace(tile);
      return;
    }
    const o = objectAt(this.s, tile.x, tile.y);
    if (o) {
      this.selectObject(o);
      return;
    }
    const b = beltAt(this.s, tile.x, tile.y);
    if (b) {
      this.selection = { kind: 'belt', x: tile.x, y: tile.y };
      this.scene?.setSelection(this.selection);
      this.updateStallPath();
      this.hud?.refresh();
      this.audio.cue('place');
      return;
    }
    this.clearSelection();
  }

  onHover(tile) {
    this.hoverTile = tile;
    if (!this.buildType) {
      this.scene?.setHover(tile);
      return;
    }
    this.updateGhost(tile);
  }

  updateGhost(tile) {
    if (!this.scene) return;
    if (!this.buildType || !tile) {
      this.scene.setBuild(null);
      return;
    }
    const check = this.validatePlacementAt(tile);
    const link = this.linkPreview(tile);
    this.scene.setBuild({
      type: this.buildType,
      rot: this.buildRot,
      tile,
      valid: check.ok,
      reason: check.ok ? '' : check.reason,
      targets: link.targets,
      linkWarn: link.warn,
    });
    this.scene.setHover(tile);
  }

  validatePlacementAt(tile) {
    if (!this.s || !this.level) return { ok: false, reason: 'No level loaded' };
    if (this.moveId) {
      const o = this.s.objects.find(x => x.id === this.moveId);
      if (!o) return { ok: false, reason: 'That object is gone' };
      return validatePlacement(this.s, this.level, this.buildType, tile.x, tile.y, { free: true, ignore: o });
    }
    return validatePlacement(this.s, this.level, this.buildType, tile.x, tile.y);
  }

  linkPreview(tile) {
    const s = this.s;
    const level = this.level;
    const targets = [];
    let warn = '';
    const def = BUILDINGS[this.buildType];
    const rot = this.buildRot;

    if (this.buildType === 'belt') {
      const [dx, dy] = DIR_VEC[rot];
      const x = tile.x + dx;
      const y = tile.y + dy;
      const targetBelt = beltAt(s, x, y);
      const targetObj = objectAt(s, x, y);
      if (targetBelt) {
        const facing = targetBelt.dir === opp(rot);
        targets.push({ x, y, ok: !facing });
        if (facing) warn = 'Belts would face each other';
      } else if (targetObj) {
        const edge = opp(rot);
        const kind = BUILDINGS[targetObj.type].kind;
        const socks = targetObj.inputs || [];
        const has = socks.some((sock, i) => socketEdgeSafe(targetObj, i) === edge);
        const onEdge = tileOnEdge(targetObj, x, y, edge);
        targets.push({ x, y, ok: has && onEdge });
        if (!has || !onEdge) warn = `${BUILDINGS[targetObj.type].name} has no socket on that side`;
      } else if (isBuildable(level, x, y)) {
        targets.push({ x, y, ok: null });
      } else {
        targets.push({ x, y, ok: false });
        warn = 'Belt ends outside the buildable area';
      }
    } else if (def.kind === 'machine' && this.buildType !== 'counter') {
      const tiles = edgeTiles({ x: tile.x, y: tile.y, w: def.w, h: def.h }, rot);
      let hasBelt = false;
      for (const [tx, ty] of tiles) {
        const b = beltAt(s, tx, ty);
        const o = objectAt(s, tx, ty);
        if (b) {
          targets.push({ x: tx, y: ty, ok: true });
          hasBelt = true;
        } else if (o) {
          targets.push({ x: tx, y: ty, ok: false });
        } else if (isBuildable(level, tx, ty)) {
          targets.push({ x: tx, y: ty, ok: null });
        }
      }
      if (!hasBelt) warn = 'Add a belt at the output edge';
      for (let i = 0; i < (def.inputs || []).length; i++) {
        const edge = i === 0 ? opp(rot) : (rot + 1) % 4;
        const edgeTileList = edgeTiles({ x: tile.x, y: tile.y, w: def.w, h: def.h }, edge);
        const fed = edgeTileList.some(([tx, ty]) => {
          const b = beltAt(s, tx, ty);
          return !!(b && b.dir === opp(edge));
        });
        if (fed) {
          const [tx, ty] = edgeTileList.find(([x, y]) => {
            const b = beltAt(s, x, y);
            return b && b.dir === opp(edge);
          });
          targets.push({ x: tx, y: ty, ok: true });
          continue;
        }
        const wall = edgeTileList.map(([tx, ty]) => ({ tx, ty, o: objectAt(s, tx, ty) }))
          .find(t => t.o && t.o.id !== this.moveId);
        if (wall) {
          const label = def.inputs[i].label ? `${def.inputs[i].label} socket` : 'Input';
          targets.push({ x: wall.tx, y: wall.ty, ok: false });
          warn = `${label} is walled in, so nothing can reach it`;
        }
      }
    } else if (def.kind === 'counter') {
      const tiles = edgeTiles({ x: tile.x, y: tile.y, w: def.w, h: def.h }, opp(rot));
      let fed = false;
      for (const [tx, ty] of tiles) {
        const b = beltAt(s, tx, ty);
        const o = objectAt(s, tx, ty);
        if (b) {
          targets.push({ x: tx, y: ty, ok: b.dir === rot });
          if (b.dir === rot) fed = true;
        } else if (o) {
          targets.push({ x: tx, y: ty, ok: false });
        }
      }
      if (!fed) warn = 'A belt must point into the counter';
    } else if (def.kind === 'source') {
      for (const lane of def.outputs) {
        const dir = (EDGE_DIR[lane.edge] + (def.rotatable ? rot : 0)) % 4;
        const [dx, dy] = DIR_VEC[dir];
        const x = tile.x + lane.tile[0] + dx;
        const y = tile.y + lane.tile[1] + dy;
        const b = beltAt(s, x, y);
        const o = objectAt(s, x, y);
        if (b) targets.push({ x, y, ok: true });
        else if (o) {
          targets.push({ x, y, ok: false });
          warn = `${ITEMS[lane.item].name} port points at ${BUILDINGS[o.type].name}, not a belt`;
        } else if (isBuildable(level, x, y)) targets.push({ x, y, ok: null });
      }
    }
    return { targets, warn };
  }

  // -------------------------------------------------------------- building

  chooseBuild(type) {
    if (!type) return;
    if (this.level?.town && !isBuildingUnlocked(type, ensureTown(this.doc.profile).townLevel)) {
      toast('Not unlocked yet', `${BUILDINGS[type].name} unlocks at Town Level ${buildingUnlockLevel(type)}.`, 'info');
      this.audio.cue('error');
      return;
    }
    if (this.buildType === type && !this.moveId) {
      this.cancelBuild();
      return;
    }
    this.moveId = null;
    this.buildType = type;
    this.buildRot = type === 'belt' ? this.buildRot : 0;
    if (this.s && !this.s.paused) {
      this.s.paused = true;
      this.autoPaused = true;
    }
    this.hud?.setBuildMode(type, this.buildRot);
    this.hud?.refresh();
    this.updateGhost(this.hoverTile);
    this.audio.cue('place');
  }

  rotateBuild() {
    if (!this.buildType) return;
    this.buildRot = (this.buildRot + 1) % 4;
    this.hud?.setBuildMode(this.buildType, this.buildRot);
    this.updateGhost(this.hoverTile);
  }

  cancelBuild() {
    if (!this.buildType && !this.moveId) return;
    this.buildType = null;
    this.moveId = null;
    this.scene?.setBuild(null);
    this.hud?.setBuildMode(null, 0);
    if (this.autoPaused && this.s) this.s.paused = false;
    this.autoPaused = false;
    this.hud?.refresh();
  }

  tryPlace(tile) {
    const check = this.validatePlacementAt(tile);
    if (!check.ok) {
      toast('Cannot place here', check.reason, 'warn');
      this.audio.cue('error');
      return;
    }

    if (this.moveId) {
      const o = this.s.objects.find(x => x.id === this.moveId);
      if (o) {
        o.x = tile.x;
        o.y = tile.y;
        o.rot = this.buildRot;
        this.s.dirty = true;
        this.moveId = null;
        this.buildType = null;
        this.scene?.setBuild(null);
        this.hud?.setBuildMode(null, 0);
        if (this.autoPaused && this.s) this.s.paused = false;
        this.autoPaused = false;
        this.scene?.refreshAll();
        this.hud?.refresh();
        this.audio.cue('place');
        this.saveSoon();
      }
      return;
    }

    if (this.buildType === 'belt') {
      const res = placeBelt(this.s, this.level, tile.x, tile.y, this.buildRot);
      if (!res.ok) {
        toast('Cannot place belt', res.reason, 'warn');
        this.audio.cue('error');
        return;
      }
      this.audio.cue('place');
    } else {
      const res = placeObject(this.s, this.level, this.buildType, tile.x, tile.y, this.buildRot);
      if (!res.ok) {
        toast('Cannot place here', res.reason, 'warn');
        this.audio.cue('error');
        return;
      }
      this.audio.cue('place');
    }

    this.scene?.refreshAll();
    this.hud?.renderBuild();
    this.hud?.setBuildMode(this.buildType, this.buildRot);
    this.hud?.refresh();
    this.updateGhost(tile);
    this.saveSoon();
  }

  // -------------------------------------------------------------- selection actions

  selectObject(o) {
    this.selection = { kind: 'object', id: o.id };
    this.scene?.setSelection(this.selection);
    this.updateStallPath();
    this.hud?.refresh();
    this.audio.cue('place');
  }

  clearSelection() {
    this.selection = null;
    this.stall = null;
    this.scene?.setSelection(null);
    this.scene?.setPath([], '');
    this.hud?.refresh();
  }

  selectedObject() {
    if (!this.selection || this.selection.kind !== 'object' || !this.s) return null;
    return this.s.objects.find(o => o.id === this.selection.id) || null;
  }

  rotateSelected() {
    if (!this.s) return;
    if (this.selection?.kind === 'belt') {
      const b = beltAt(this.s, this.selection.x, this.selection.y);
      if (!b) return;
      b.dir = (b.dir + 1) % 4;
      this.s.dirty = true;
      this.scene?.refreshAll();
      this.hud?.refresh();
      this.audio.cue('place');
      this.saveSoon();
      return;
    }
    const o = this.selectedObject();
    if (!o) return;
    if (o.fixed) {
      toast('This part is fixed', 'Preplaced workshop pieces stay where they are.', 'info');
      return;
    }
    o.rot = (o.rot + 1) % 4;
    this.s.dirty = true;
    this.scene?.refreshAll();
    this.hud?.refresh();
    this.audio.cue('place');
    this.saveSoon();
  }

  moveSelected() {
    const o = this.selectedObject();
    if (!o) return;
    if (o.fixed) {
      toast('This part is fixed', 'Preplaced workshop pieces cannot be moved.', 'info');
      return;
    }
    this.buildType = o.type;
    this.buildRot = o.rot;
    this.moveId = o.id;
    this.selection = null;
    this.scene?.setSelection(null);
    if (this.s && !this.s.paused) {
      this.s.paused = true;
      this.autoPaused = true;
    }
    this.hud?.setBuildMode(o.type, o.rot);
    this.hud?.refresh();
    this.updateGhost(this.hoverTile);
    this.audio.cue('place');
    toast(`Moving ${BUILDINGS[o.type].name}`, 'Click a free spot. Moving is free and keeps everything inside.', 'info');
  }

  // Item-index dialogs must not run while the counter or a machine can consume
  // what is behind the dialog, so hold the simulation for the confirmation.
  confirmWithPause(opts) {
    let resume = false;
    if (this.s && !this.s.paused && !this.s.levelDone) {
      this.s.paused = true;
      resume = true;
      this.hud?.refresh();
    }
    return confirmAction(opts).finally(() => {
      if (resume && this.s && !this.s.levelDone) {
        this.s.paused = false;
        this.hud?.refresh();
      }
    });
  }

  sellSelected() {
    const o = this.selectedObject();
    if (!o || !this.s) return;
    if (o.fixed) {
      toast('This part is fixed', 'Preplaced workshop pieces cannot be sold.', 'info');
      return;
    }
    const refund = refundFor(o.type);
    const inside = contentsOf(o);
    this.confirmWithPause({
      title: `Sell the ${BUILDINGS[o.type].name}?`,
      message: inside.length
        ? `You get ${refund} coins back (70% of the price). ${inside.length} ${inside.length === 1 ? 'item is' : 'items are'} still inside (${inside.map(i => ITEMS[i.type].name).join(', ')}) and will be lost. Items already on belts stay where they are.`
        : `You get ${refund} coins back (70% of the price). Items already on belts stay where they are.`,
      confirmLabel: `Sell for ${refund}`,
      danger: true,
    }).then((ok) => {
      if (!ok || !this.s) return;
      const res = sellObject(this.s, this.level, o.id);
      if (!res.ok) {
        toast('Could not sell', res.reason, 'warn');
        return;
      }
      this.selection = null;
      this.scene?.setSelection(null);
      this.scene?.refreshAll();
      this.hud?.renderBuild();
      this.hud?.refresh();
      this.audio.cue('place');
      this.saveSoon();
      toast('Sold', res.lost ? `+${refund} coins · ${res.lost} inside lost.` : `+${refund} coins.`, 'good');
    });
  }

  sellSelectedBelt() {
    if (!this.s || this.selection?.kind !== 'belt') return;
    const { x, y } = this.selection;
    const b = beltAt(this.s, x, y);
    if (!b) return;
    this.confirmWithPause({
      title: 'Sell this belt?',
      message: `You get ${refundFor('belt')} coins back. Anything sitting on the belt is discarded.`,
      confirmLabel: 'Sell belt',
    }).then((ok) => {
      if (!ok || !this.s) return;
      const res = sellBelt(this.s, x, y);
      if (!res.ok) {
        toast('Cannot sell', res.reason || 'This belt cannot be sold.', 'warn');
        return;
      }
      this.selection = null;
      this.scene?.setSelection(null);
      this.scene?.refreshAll();
      this.hud?.refresh();
      this.audio.cue('place');
      this.saveSoon();
    });
  }

  removeSelectedItem() {
    if (!this.s || this.selection?.kind !== 'belt') return;
    const { x, y } = this.selection;
    const b = beltAt(this.s, x, y);
    if (!b || !b.item) return;
    this.confirmWithPause({
      title: 'Remove this item?',
      message: 'The item is discarded with no refund. This is the guaranteed way out of a wrong item or spoiled goods.',
      confirmLabel: 'Remove item',
      danger: true,
    }).then((ok) => {
      if (!ok || !this.s) return;
      removeBeltItem(this.s, x, y, this.fx);
      this.scene?.refreshAll();
      this.hud?.refresh();
      this.saveSoon();
    });
  }

  discardCounterItem(index) {
    const o = this.selectedObject();
    if (!o || o.type !== 'counter') return;
    this.confirmWithPause({
      title: 'Discard buffered item?',
      message: 'The item leaves the counter and no coins are paid. This frees the slot for an order item.',
      confirmLabel: 'Discard',
      danger: true,
    }).then((ok) => {
      if (!ok || !this.s) return;
      discardCounterItemSim(this.s, o.id, index);
      this.hud?.refresh();
      this.saveSoon();
    });
  }

  discardMachineInput(objectId, socketIndex, itemIndex) {
    const object = this.s?.objects.find(o => o.id === objectId);
    const item = object?.inputs?.[socketIndex]?.buf?.[itemIndex];
    if (!item) return;
    this.confirmWithPause({
      title: 'Remove this buffered item?',
      message: `${ITEMS[item.type]?.name || 'Item'} is discarded with no refund. This clears the machine input.`,
      confirmLabel: 'Remove item',
      danger: true,
    }).then(ok => {
      if (!ok || !this.s) return;
      discardMachineInputItem(this.s, objectId, socketIndex, itemIndex);
      this.scene?.refreshAll();
      this.hud?.refresh();
      this.saveSoon();
    });
  }

  buyCream() {
    const o = this.selectedObject();
    if (!o || o.type !== 'dairyCrate' || !this.s) return;
    const res = buyCreamState(this.s, this.level, o.id);
    if (!res.ok) {
      toast('Cannot buy cream', res.reason, 'warn');
      this.audio.cue('error');
      return;
    }
    this.audio.cue('place');
    const left = this.level.creamCap - this.s.creamBought;
    if (left <= 0) {
      toast('That was the last cream', 'No cream buys left this level, so no more ice cream tubs can be made. Restart the level from the pause menu if you still need tubs.', 'warn');
    } else if (left <= 2) {
      toast('Cream running low', `${left} buys left this level. Each ice cream needs one.`, 'warn');
    }
    this.scene?.refreshBuffers();
    this.hud?.refresh();
    this.saveSoon();
  }

  upgradeSpeed() {
    const o = this.selectedObject();
    if (!o || !this.s) return;
    if (this.level?.town && ensureTown(this.doc.profile).townLevel < SPEED_UPGRADE_LEVEL) {
      toast('Not unlocked yet', `Speed upgrades unlock at Town Level ${SPEED_UPGRADE_LEVEL}.`, 'info');
      return;
    }
    const res = upgradeSpeedState(this.s, o.id);
    if (!res.ok) {
      toast('Cannot upgrade', res.reason, 'warn');
      this.audio.cue('error');
      return;
    }
    this.audio.cue('complete');
    this.hud?.refresh();
    this.saveSoon();
  }

  upgradeCooling() {
    const o = this.selectedObject();
    if (!o || !this.s) return;
    const res = upgradeCoolingState(this.s, o.id);
    if (!res.ok) {
      toast('Cannot upgrade', res.reason, 'warn');
      this.audio.cue('error');
      return;
    }
    this.audio.cue('complete');
    this.hud?.refresh();
    this.saveSoon();
  }

  sendErrand() {
    if (!this.s) return;
    if (sendErrandSim(this.s)) {
      const e = this.s.orders.errand;
      toast('Runner sent', `They will return with ${e.reward} coins in ${Math.ceil(e.remaining / 10)} seconds.`, 'good');
      this.audio.cue('customer');
      this.hud?.refresh();
      this.saveSoon();
    }
  }

  dismissHints() {
    if (!this.s) return;
    this.s.hintDismissed = true;
    this.scene?.setHints([]);
    this.hud?.refresh();
    this.saveSoon();
  }

  // -------------------------------------------------------------- tutorial

  stepSatisfied(step) {
    const c = step.check || {};
    const s = this.s;
    if (!s) return false;
    switch (c.kind) {
      case 'hasType': return s.objects.some(o => o.type === c.type);
      case 'playerBelts': return s.counters.beltsPlaced >= c.n;
      case 'fulfilledType': return (s.counters.byType[c.type] || 0) > 0;
      case 'boughtCream': return s.creamBought > 0;
      case 'levelDone': return s.trackers.completed;
      default: return false;
    }
  }

  tutorialState() {
    const steps = this.level?.tutorialSteps || [];
    if (!steps.length || !this.s) return null;
    let index = steps.findIndex(st => !this.stepSatisfied(st));
    if (index < 0) return { index: steps.length - 1, total: steps.length, step: steps[steps.length - 1], done: true };
    return { index, total: steps.length, step: steps[index], done: false };
  }

  onTutorialStep(st) {
    if (!st || st.done) {
      this.scene?.setHints([]);
      return;
    }
    this.scene?.setHints(st.step.tiles || []);
  }

  // -------------------------------------------------------------- pause / camera

  openPause() {
    if (!this.s || document.querySelector('.backdrop')) return;
    this.s.paused = true;
    this.autoPaused = false;
    this.hud?.refresh();
    const prog = primaryProgress(this.level, this.s);
    const dlg = openDialog({
      title: 'Workshop paused',
      body: `<p>${levelNumberLabel(this.level)} · ${escapeText(this.level.name)}</p>
        <p>Objective: ${escapeText(this.level.objective.text)} <b>${prog.done}/${prog.total}</b>${prog.extra ? ` · ${escapeText(prog.extra)}` : ''}</p>
        <p style="margin-bottom:0">Production and patience are stopped. Everything is saved as you go.</p>`,
      actions: [
        {
          label: 'Resume', kind: 'primary', autofocus: true,
          onClick: () => {
            if (this.s && !this.s.levelDone) this.s.paused = false;
            this.hud?.refresh();
          },
        },
        {
          label: 'Restart level', kind: 'quiet',
          onClick: () => {
            confirmAction({
              title: 'Restart this level?',
              message: this.level.town
                ? 'This clears your town layout and coins. Town Level, story, daily goals and permits are kept.'
                : 'The current layout and coins are replaced by the level start. Completed levels stay unlocked.',
              confirmLabel: 'Restart',
            }).then((ok) => {
              if (ok) this.startLevel(this.level.id, { resume: false });
              else if (this.s && !this.s.levelDone) {
                this.s.paused = false;
                this.hud?.refresh();
              }
            });
          },
        },
        { label: 'How to play', kind: 'quiet', onClick: () => openHowTo({ onReplay: () => this.restoreHints() }) },
        { label: 'Save & exit', onClick: () => this.exitToMenu() },
      ],
    });
    if (dlg && dlg.onClose) {
      dlg.onClose((result) => {
        if (!result && this.s && !this.s.levelDone) {
          this.s.paused = false;
          this.hud?.refresh();
        }
      });
    }
  }

  pan(dir) {
    if (!this.scene) return;
    const stepPx = 52;
    if (dir === 'up') this.scene.panBy(0, -stepPx);
    else if (dir === 'down') this.scene.panBy(0, stepPx);
    else if (dir === 'left') this.scene.panBy(-stepPx, 0);
    else if (dir === 'right') this.scene.panBy(stepPx, 0);
  }

  rotateCameraTo(degrees) {
    this.scene?.setOrbitYawDegrees(degrees);
  }

  resetCameraOrbit() {
    this.rotateCameraTo(0);
  }

  onCameraOrbit(degrees) {
    this.hud?.setCameraYaw(degrees);
  }

  zoom(factor) {
    this.scene?.zoomBy(factor);
  }

  recenter() {
    this.scene?.centerOnLevel();
  }

  // The painted path and the inspector text come from one trace, so they cannot
  // end up pointing at different tiles (PRD FR-13).
  updateStallPath() {
    if (!this.scene) return;
    const rep = stallReport(this.s, this.selection);
    this.stall = rep;
    this.scene.setPath(rep.tiles, rep.tone);
  }

  // §6.8: every shortage explanation carries a jump-to action.
  jumpTo(target) {
    if (!this.s || !target) return;
    if (target.kind === 'object') {
      const o = this.s.objects.find(x => x.id === target.id);
      if (!o) return;
      this.selectObject(o);
      this.scene?.focusTile(o.x + (o.w - 1) / 2, o.y + (o.h - 1) / 2);
      return;
    }
    if (target.kind === 'belt') {
      this.selection = { kind: 'belt', x: target.x, y: target.y };
      this.scene?.setSelection(this.selection);
      this.updateStallPath();
      this.scene?.focusTile(target.x, target.y);
      this.hud?.refresh();
      return;
    }
    if (target.kind === 'build') this.startBuildFor(target);
  }

  startBuildFor(target) {
    if (!this.level || !this.level.available.includes(target.building)) {
      toast('Nothing here makes this', `${target.label} is not offered on this map.`, 'warn');
      return;
    }
    this.chooseBuild(target.building);
    const name = ITEMS[target.item] ? ITEMS[target.item].name.toLowerCase() : 'supply';
    toast(`Place a ${target.label}`, `Nothing on this map makes ${name}. Put the ${target.label} where a belt can reach it.`, 'good');
  }

  restoreHints() {
    if (!this.s) return;
    this.s.hintDismissed = false;
    const st = this.tutorialState();
    if (st) this.onTutorialStep(st);
    this.hud?.refresh();
    this.saveSoon();
  }

  // -------------------------------------------------------------- saves

  serializeState() {
    const snap = JSON.parse(JSON.stringify(this.s));
    snap.belts = Object.values(snap.belts || {});
    delete snap.notices;
    return snap;
  }

  async saveNow() {
    if (!this.doc || !this.canSave) return;
    clearTimeout(this.saveTimer);
    if (this.saving) {
      this.saveQueued = true;
      return;
    }
    this.doc.profile.settings = { ...this.settings };
    if (this.level?.town) this.doc.profile.lastSeenAt = Date.now();
    if (this.s && this.level) {
      this.doc.level = { levelId: this.level.id, state: this.serializeState() };
    }
    this.doc.updatedAt = Date.now();
    this.saving = true;
    this.hud?.setSaveState('Saving…', true);
    try {
      await this.store.save(this.doc);
      this.hud?.setSaveState('Saved', false);
    } catch (err) {
      this.hud?.setSaveState('Not saved', false);
      toast('Could not save', 'Browser storage is blocked or full. This session keeps running; progress may not survive a refresh.', 'warn');
    } finally {
      this.saving = false;
      if (this.saveQueued) {
        this.saveQueued = false;
        this.saveNow();
      }
    }
  }

  saveSoon() {
    if (!this.canSave) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 2000);
  }

  // -------------------------------------------------------------- input and lifecycle

  installInput() {
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented) return;
      if (document.querySelector('.backdrop')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      const onButton = e.target.closest && e.target.closest('button');
      if (!this.s && !['b', 'p', ' '].includes(e.key)) return;

      if (e.key === 'Escape') {
        if (this.hud?.anySheetOpen()) { this.hud.closeSheet(); e.preventDefault(); return; }
        if (this.buildType || this.moveId) { this.cancelBuild(); e.preventDefault(); return; }
        if (this.s) { this.openPause(); e.preventDefault(); }
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && onButton) return;

      switch (e.key) {
        case ' ':
          if (!this.s) return;
          this.togglePause();
          e.preventDefault();
          break;
        case 'p': case 'P':
          if (!this.s) return;
          this.togglePause();
          break;
        case 'r': case 'R':
          if (this.buildType) this.rotateBuild();
          break;
        case 'b': case 'B':
          if (this.s) {
            if (window.matchMedia('(max-height: 520px), (max-width: 800px)').matches) this.hud?.toggleSheet('build');
            else this.hud?.el.buildBody.querySelector('[data-build]')?.focus();
          }
          break;
        case '1': case '2':
          if (!this.s) return;
          this.speed = Number(e.key);
          this.hud?.refresh();
          break;
        case 'ArrowUp': this.pan('up'); e.preventDefault(); break;
        case 'ArrowDown': this.pan('down'); e.preventDefault(); break;
        case 'ArrowLeft': this.pan('left'); e.preventDefault(); break;
        case 'ArrowRight': this.pan('right'); e.preventDefault(); break;
        case '+': case '=': this.zoom(1.15); e.preventDefault(); break;
        case '-': case '_': this.zoom(1 / 1.15); e.preventDefault(); break;
        case 'm': case 'M':
          this.setSetting('muted', !this.settings.muted);
          break;
        case 'h': case 'H':
          this.setSetting('hints', !this.settings.hints);
          break;
        case 'i': case 'I':
          if (this.s) this.openWorkshopReport();
          break;
        default: break;
      }
    });

    const unlock = () => this.unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.getElementById('ui').addEventListener('lbw-complete-action', (e) => {
      this.handleCompleteAction(e.detail);
    });
  }

  unlockAudio() {
    if (!this.doc) return;
    this.audio.unlock();
    this.audio.applySettings(this.settings);
    this.audio.startMusic();
  }

  installLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveNow();
      } else if (this.audio && this.audio.ctx && this.audio.ctx.state === 'suspended') {
        this.audio.ctx.resume();
      }
    });
    window.addEventListener('pagehide', () => this.saveNow());
    window.addEventListener('beforeunload', () => this.saveNow());
    window.addEventListener('resize', () => {
      if (this.hud?.anySheetOpen() && window.innerHeight > 540) this.hud.closeSheet();
    });
  }
}

function socketEdgeSafe(o, index) {
  if (!o.inputs) return -1;
  if (o.inputs.length === 1) return opp(o.rot);
  return index === 0 ? opp(o.rot) : (o.rot + 1) % 4;
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ctrl = new Controller();
// No other handle reaches the controller from the page, so browser checks need this.
window.__lbw = ctrl;
ctrl.boot().catch((err) => {
  console.error(err);
  const ui = document.getElementById('ui');
  if (ui) {
    ui.innerHTML = `<div class="screen"><div class="screen-inner"><h1>Little Batch Works</h1><p>The game could not start. Try reloading the page.</p></div></div>`;
  }
});
