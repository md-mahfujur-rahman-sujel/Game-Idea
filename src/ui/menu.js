import { ICONS, brandMark, buildingIcon } from './icons.js';
import { icon, openDialog, escapeHtml, timeAgo } from './dom.js';
import { LEVELS, LEVEL_BY_ID } from '../data/levels.js';

const HERO_ART = `
<svg viewBox="0 0 520 320" role="img" aria-label="A small sunny workshop with wooden crates, a peach tree, and a mint freezer chest">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eaf0f7"/><stop offset="1" stop-color="#d9e4f0"/>
    </linearGradient>
  </defs>
  <rect width="520" height="320" rx="14" fill="url(#sky)"/>
  <g opacity=".55">
    <circle cx="430" cy="58" r="30" fill="#f4e6b0"/>
    <circle cx="72" cy="48" r="18" fill="#fbf4e6"/>
    <circle cx="102" cy="44" r="22" fill="#fbf4e6"/>
    <circle cx="132" cy="50" r="16" fill="#fbf4e6"/>
  </g>
  <path d="M0 244h520v76H0z" fill="#c9c7a0"/>
  <path d="M0 244h520v10H0z" fill="#ada87e"/>
  <g>
    <path d="M150 126h196v108H150z" fill="#f2e9d4" stroke="#6a363b" stroke-width="3"/>
    <path d="M150 94h196l18 32H132z" fill="#8e4f53" stroke="#6a363b" stroke-width="3"/>
    <path d="M168 94l-12 32M204 94l-6 32M240 94v32M276 94l6 32M312 94l12 32" stroke="#6a363b" stroke-width="2" opacity=".5"/>
    <path d="M214 172h68v62h-68z" fill="#6a363b" opacity=".16"/>
    <rect x="226" y="184" width="44" height="50" rx="4" fill="#b06a6c" stroke="#6a363b" stroke-width="2.5"/>
    <rect x="236" y="150" width="24" height="22" rx="4" fill="#adc1be" stroke="#4f7064" stroke-width="2.5"/>
    <path d="M248 153v16M242 158l12 6M254 158l-12 6" stroke="#4f7064" stroke-width="1.6"/>
    <path d="M160 142h28v20h-28z" fill="#fffbf3" stroke="#a4ab46" stroke-width="2"/>
    <path d="M164 136h20v6h-20z" fill="#8e4f53"/>
  </g>
  <g>
    <path d="M72 264h52l-6 30H78z" fill="#b58a6c" stroke="#6e5441" stroke-width="2.5"/>
    <path d="M72 272h52M84 264v30M104 264v30" stroke="#6e5441" stroke-width="2" opacity=".55"/>
    <circle cx="88" cy="254" r="9" fill="#c98e7e" stroke="#6a363b" stroke-width="2"/>
    <circle cx="104" cy="250" r="8" fill="#9e4b4f" stroke="#6a363b" stroke-width="2"/>
    <path d="M104 242c1-5 4-8 8-8" stroke="#3f5c35" stroke-width="2.4" fill="none"/>
  </g>
  <g>
    <path d="M378 250h84l-8 44h-68z" fill="#adc1be" stroke="#4f7064" stroke-width="3"/>
    <path d="M370 242h100v14H370z" fill="#fffbf3" stroke="#4f7064" stroke-width="3"/>
    <circle cx="420" cy="274" r="9" fill="none" stroke="#4f7064" stroke-width="2.4"/>
    <path d="M420 268v6l4 3" stroke="#4f7064" stroke-width="2.2" fill="none"/>
  </g>
  <g>
    <path d="M356 214v-54" stroke="#6e5441" stroke-width="6"/>
    <circle cx="356" cy="146" r="34" fill="#708549"/>
    <circle cx="332" cy="160" r="22" fill="#3f5c35"/>
    <circle cx="382" cy="160" r="20" fill="#708549"/>
    <circle cx="344" cy="140" r="5" fill="#c98e7e"/>
    <circle cx="370" cy="132" r="5" fill="#c98e7e"/>
    <circle cx="382" cy="156" r="5" fill="#9e4b4f"/>
  </g>
  <g>
    <rect x="252" y="228" width="96" height="16" rx="5" fill="#b58a6c" stroke="#6e5441" stroke-width="2.5"/>
    <path d="M258 232h84M258 240h84" stroke="#6e5441" stroke-width="1.5" opacity=".5"/>
    <circle cx="278" cy="224" r="8" fill="#ddb3a0" stroke="#8e4f53" stroke-width="2"/>
    <circle cx="312" cy="222" r="7" fill="#adc1be" stroke="#4f7064" stroke-width="2"/>
  </g>
  <g transform="translate(440 196)">
    <path d="M0 34h30l-3 22H3z" fill="#8e4f53" stroke="#6a363b" stroke-width="2.5"/>
    <path d="M4 34c0-14 4.6-22 11-22s11 8 11 22" fill="none" stroke="#23282b" stroke-width="2.5"/>
    <path d="M12 12V6c0-2 2-3 4-3" fill="none" stroke="#23282b" stroke-width="2.5"/>
  </g>
</svg>`;

function shell(inner) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.dataset.layer = 'screen';
  screen.innerHTML = `<div class="screen-inner">${inner}</div>`;
  return screen;
}

function masthead(doc) {
  return `
  <header class="masthead">
    <div class="mark">${brandMark()}</div>
    <div class="wm">Little Batch Works<small>Sunbeam Workshop</small></div>
    <div class="spacer"></div>
    <span class="save-status"><span class="dot"></span>Saved ${doc?.updatedAt ? timeAgo(doc.updatedAt) : 'locally'}</span>
  </header>`;
}

export function renderMainMenu(root, ctx) {
  root.querySelectorAll('[data-layer="screen"]').forEach(el => el.remove());
  const { doc } = ctx;
  const profile = doc.profile || {};
  const hasSave = !!doc.level;
  const level = hasSave ? LEVEL_BY_ID[doc.level.levelId] : null;
  const townUnlocked = (profile.unlocked || []).includes('town');
  const townLevel = Math.max(1, Math.floor(Number(profile.townLevel) || 1));
  const chapterCount = Math.max(0, Math.floor(Number(profile.story?.chapter) || 0));
  const ordersServed = Math.max(0, Math.floor(Number(profile.stats?.fulfilled) || 0));
  const finishedLevels = Object.keys(profile.completed || {}).filter(id => LEVEL_BY_ID[id] && id !== 'town').length;
  const screen = shell(`
    ${masthead(doc)}
    <section class="home-hero">
      <div class="home-welcome">
        <div class="eyebrow"><span class="eyebrow-dot"></span> A COZY FACTORY SAGA</div>
        <h1>A small workshop.<br><em>A town full of stories.</em></h1>
        <p>Grow a food business one clever belt at a time. Learn the craft in the story campaign, then keep building Mosslight Market for as long as you like.</p>
        <div class="home-actions">
          ${hasSave
            ? `<button class="btn btn-primary home-continue" data-act="continue"><span>${icon('play')}</span><span><b>Continue playing</b><small>${escapeHtml(level ? level.town ? 'Your ongoing town saga' : `${levelNumberLabel(level)} · ${level.name}` : 'Your saved workshop')}</small></span><span class="action-arrow">${icon('arrow')}</span></button>`
            : `<button class="btn btn-primary home-continue" data-act="new"><span>${icon('play')}</span><span><b>Begin your story</b><small>Start with a guided first workshop</small></span><span class="action-arrow">${icon('arrow')}</span></button>`}
          <button class="btn btn-quiet" data-act="levels">Explore the story</button>
        </div>
        <div class="home-save-note"><span class="save-pip"></span>${hasSave
          ? `Saved ${doc.updatedAt ? timeAgo(doc.updatedAt) : 'on this device'} · Your progress stays on this device.`
          : 'No account needed · Your progress saves on this device.'}</div>
      </div>
      <aside class="saga-feature ${townUnlocked ? 'is-open' : 'is-locked'}">
        <div class="saga-art">${HERO_ART}<div class="saga-art-shade"></div><span class="saga-art-label">MOSSLIGHT MARKET <i>✦</i></span></div>
        <div class="saga-feature-copy">
          <div class="feature-kicker">${townUnlocked ? 'YOUR ONGOING SAGA' : 'YOUR NEXT DESTINATION'}</div>
          <h2>Mosslight Market</h2>
          <p>${townUnlocked ? 'A persistent town, new neighbors, and a story that keeps unfolding as your workshop grows.' : 'Complete “A Fresh Batch” to carry your craft into a persistent town with neighbors, expansions, and new story goals.'}</p>
          <button class="saga-link" data-act="${townUnlocked ? 'town' : 'levels'}">${townUnlocked ? 'Return to your town' : 'See the story path'} <span aria-hidden="true">↗</span></button>
        </div>
        <div class="saga-metrics">
          <div><b>${townUnlocked ? `LV ${townLevel}` : `${finishedLevels}/6`}</b><span>${townUnlocked ? 'TOWN LEVEL' : 'STORY MAPS'}</span></div>
          <div><b>${chapterCount}</b><span>CHAPTERS CLEARED</span></div>
          <div><b>${ordersServed}</b><span>ORDERS SERVED</span></div>
        </div>
      </aside>
    </section>
    <section class="home-tools" aria-label="More options">
      <button class="home-tool" data-act="levels"><span class="tool-icon">${icon('build')}</span><span><b>Story campaign</b><small>Six handcrafted chapters</small></span><span class="tool-arrow">↗</span></button>
      <button class="home-tool" data-act="settings"><span class="tool-icon">${icon('settings')}</span><span><b>Settings</b><small>Audio, comfort and controls</small></span><span class="tool-arrow">↗</span></button>
      <button class="home-tool" data-act="how"><span class="tool-icon">${icon('hand')}</span><span><b>How to play</b><small>Routing, machines and orders</small></span><span class="tool-arrow">↗</span></button>
      <button class="home-tool" data-act="credits"><span class="tool-icon">${icon('sparkle')}</span><span><b>About</b><small>Meet the workshop</small></span><span class="tool-arrow">↗</span></button>
    </section>
  `);
  screen.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'continue') ctx.onContinue();
    else if (act === 'new') ctx.onNew();
    else if (act === 'levels') ctx.onLevels();
    else if (act === 'town') ctx.onLevel('town');
    else if (act === 'settings') ctx.onSettings();
    else if (act === 'how') openHowTo();
    else if (act === 'credits') openCredits();
    else if (act === 'reset' && ctx.onReset) ctx.onReset();
  });
  root.appendChild(screen);
}

export function renderLevelSelect(root, ctx) {
  root.querySelectorAll('[data-layer="screen"]').forEach(el => el.remove());
  const { doc } = ctx;
  const unlocked = new Set(doc.profile.unlocked);
  const done = doc.profile.completed || {};
  const storyLevels = LEVELS.filter(level => !level.town);
  const groups = new Map();
  storyLevels.forEach(level => {
    const chapter = level.chapter || 'The Workshop Trail';
    if (!groups.has(chapter)) groups.set(chapter, []);
    groups.get(chapter).push(level);
  });
  const cards = [...groups.entries()].map(([chapter, levels]) => `
    <section class="campaign-chapter">
      <div class="campaign-chapter-head"><span class="chapter-rule"></span><span>${escapeHtml(chapter)}</span><span class="chapter-rule"></span></div>
      <div class="campaign-grid">${levels.map((lv) => {
    const isUnlocked = unlocked.has(lv.id);
    const rec = done[lv.id];
    const optional = lv.optional || [];
    const earned = rec?.optional?.length || 0;
    return `
      <button class="campaign-card ${isUnlocked ? '' : 'locked'} ${rec ? 'done' : ''}" data-level="${lv.id}" ${isUnlocked ? '' : 'disabled aria-disabled="true"'}>
        <span class="campaign-card-top"><span class="campaign-index">${escapeHtml(lv.num === 'T' ? 'START' : `0${lv.num}`)}</span><span class="campaign-state ${rec ? 'complete' : ''}">${rec ? `${icon('check')} COMPLETE` : isUnlocked ? 'READY TO PLAY' : `${icon('lock')} LOCKED`}</span></span>
        <span class="campaign-title">${escapeHtml(lv.name)}</span>
        <span class="campaign-objective">${escapeHtml(lv.objective.text)}</span>
        <span class="campaign-card-bottom"><span>${lv.num === 'T' ? 'GUIDED INTRODUCTION' : `CHAPTER ${escapeHtml(lv.num)}`}</span>${optional.length ? `<b>${earned}/${optional.length} MASTERY MARKS</b>` : '<b>STORY MISSION</b>'}</span>
      </button>`;
  }).join('')}</div>
    </section>`).join('');
  const townUnlocked = unlocked.has('town');
  const townLevel = Math.max(1, Math.floor(Number(doc.profile.townLevel) || 1));
  const sagaChapter = Math.max(0, Math.floor(Number(doc.profile.story?.chapter) || 0));
  const screen = shell(`
    ${masthead(doc)}
    <div class="campaign-heading">
      <div><div class="eyebrow">THE JOURNEY SO FAR</div><h1>Build your way into the story.</h1><p>Learn each craft, meet the neighbors, and bring what you discover back to town.</p></div>
      <button class="btn btn-quiet campaign-back" data-act="back"><span class="campaign-back-arrow">${icon('arrow')}</span> Main menu</button>
    </div>
    <section class="town-destination ${townUnlocked ? 'is-open' : 'is-locked'}">
      <div class="town-destination-mark">${icon('sparkle')}</div>
      <div class="town-destination-copy"><div class="feature-kicker">${townUnlocked ? 'PERSISTENT TOWN · YOUR STORY CONTINUES' : 'THE ONGOING SAGA'}</div><h2>Mosslight Market</h2><p>${townUnlocked ? 'Your town is saved separately from campaign maps. Serve neighbors, expand the island, and discover new chapter goals.' : 'Complete “A Fresh Batch” to unlock your persistent town, meet its neighbors, and grow a saga beyond the campaign.'}</p></div>
      <div class="town-destination-stats"><div><b>${townUnlocked ? `LV ${townLevel}` : '6 MAPS'}</b><span>${townUnlocked ? 'TOWN LEVEL' : 'STORY CAMPAIGN'}</span></div><div><b>${sagaChapter}</b><span>CHAPTERS CLEARED</span></div></div>
      <button class="btn ${townUnlocked ? 'btn-primary' : ''} town-destination-action" data-level="town" ${townUnlocked ? '' : 'disabled aria-disabled="true"'}>${townUnlocked ? 'Open your town' : `${icon('lock')} Unlock after “A Fresh Batch”`}</button>
    </section>
    <div class="campaign-section-title"><div><div class="feature-kicker">THE HANDCRAFTED CAMPAIGN</div><h2>Six missions. One growing craft.</h2></div><span>INTRO + ${storyLevels.length - 1} MISSIONS</span></div>
    <section class="campaign-chapters">${cards}</section>
  `);
  screen.addEventListener('click', (e) => {
    const back = e.target.closest('[data-act="back"]');
    if (back) { ctx.onBack(); return; }
    const card = e.target.closest('[data-level]');
    if (!card || card.disabled) return;
    ctx.onLevel(card.dataset.level);
  });
  root.appendChild(screen);
}

export function openHowTo(opts = {}) {
  const actions = [];
  if (opts.onReplay) {
    actions.push({ label: 'Replay the tutorial prompts here', kind: 'quiet', onClick: opts.onReplay });
  }
  actions.push({ label: 'Got it', kind: 'primary', autofocus: true });
  openDialog({
    title: 'How to play',
    wide: true,
    dismissible: true,
    body: `
      <p>You are running a tiny food workshop. Customers queue at the counter; you grow, process, and deliver.</p>
      <div class="kv" style="grid-template-columns:110px 1fr;display:grid;gap:8px 12px;margin:0 0 12px">
        <dt>Belts</dt><dd style="text-align:left;font-weight:600">One item per tile, one tile per second. A belt only moves when the next tile or socket has room.</dd>
        <dt>Sockets</dt><dd style="text-align:left;font-weight:600">Every machine port is a labeled socket. Two-input machines need one belt into <b>A</b> and another into <b>B</b>.</dd>
        <dt>No skipping</dt><dd style="text-align:left;font-weight:600">Machines never hand items to each other directly. Put at least one belt between ports.</dd>
        <dt>Blockages</dt><dd style="text-align:left;font-weight:600">Select a machine or belt to read the exact reason and see the belt path it affects, highlighted on the map. Any belt item can be removed if it is stuck.</dd>
        <dt>Cold chain</dt><dd style="text-align:left;font-weight:600">Tubs are chilled only inside the Freezer and the counter. On a belt they hold 45 seconds, even while blocked; the ring above each tub shows its remaining chill. Melted Mix can be refrozen twice; each cycle leaves less time to deliver it.</dd>
        <dt>Report</dt><dd style="text-align:left;font-weight:600">Press <b>I</b> or use the chart button for a paused workshop report. It lists the live bottlenecks, cold-chain numbers, and a <b>Go</b> button to each problem.</dd>
        <dt>Pause</dt><dd style="text-align:left;font-weight:600">Space or the pause button stops production and patience. Build mode pauses by default.</dd>
        <dt>Touch</dt><dd style="text-align:left;font-weight:600">Tap to select or place; move one finger more than 5 px to orbit, then release for a gentle coast. Twist two fingers to rotate, slide them vertically to tilt, pinch to zoom, and slide horizontally to pan. Drag the compass heading slider for a precise bearing; tap its compass to face north.</dd>
        <dt>Hints</dt><dd style="text-align:left;font-weight:600">The tutorial strip can be dismissed and brought back with <b>Show tutorial hints</b>, or from this dialog at any time.</dd>
      </div>
      <p style="margin:0">Progress saves automatically on this device. Close the tab whenever you like.</p>`,
    actions,
  });
}

export function openCredits() {
  openDialog({
    title: 'About this workshop',
    body: `
      <p><b>Little Batch Works</b> is an original 3D voxel factory game built with Three.js and vanilla JavaScript.</p>
      <p>All buildings, characters, signage, and names are original to this project. Art is drawn procedurally in code, and every sound cue is synthesised at runtime, so the game runs fully offline.</p>
      <p style="margin-bottom:0">Version 1.0 · web build. Designed for 5–20 minute sessions.</p>`,
    actions: [{ label: 'Close', kind: 'quiet', autofocus: true }],
  });
}

export function openSettings(ctx) {
  const s = ctx.settings;
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="settings">
      <div class="set-row">
        <div class="set-t"><div class="st">Music</div><div class="ss">A gentle market loop.</div></div>
        <input type="range" min="0" max="100" value="${Math.round(s.music * 100)}" data-set="music" aria-label="Music volume">
        <output>${Math.round(s.music * 100)}%</output>
      </div>
      <div class="set-row">
        <div class="set-t"><div class="st">Sound effects</div><div class="ss">Belts, orders, and machine chimes.</div></div>
        <input type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" data-set="sfx" aria-label="Sound effect volume">
        <output>${Math.round(s.sfx * 100)}%</output>
      </div>
      <div class="set-row">
        <div class="set-t"><div class="st">Mute everything</div><div class="ss">Silences music and effects together.</div></div>
        <label class="switch"><input type="checkbox" data-set="muted" ${s.muted ? 'checked' : ''} aria-label="Mute everything"><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="set-t"><div class="st">Reduced motion</div><div class="ss">Stops idle bobbing and pulsing hints.</div></div>
        <label class="switch"><input type="checkbox" data-set="reducedMotion" ${s.reducedMotion ? 'checked' : ''} aria-label="Reduced motion"><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="set-t"><div class="st">Grid overlay</div><div class="ss">Always show tile edges on the map.</div></div>
        <label class="switch"><input type="checkbox" data-set="gridOverlay" ${s.gridOverlay ? 'checked' : ''} aria-label="Grid overlay"><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="set-t"><div class="st">Tutorial hints</div><div class="ss">Show the guided step strip during a level.</div></div>
        <label class="switch"><input type="checkbox" data-set="hints" ${s.hints ? 'checked' : ''} aria-label="Tutorial hints"><span class="track"></span></label>
      </div>
    </div>`;
  body.addEventListener('input', (e) => {
    const key = e.target.dataset.set;
    if (!key) return;
    if (e.target.type === 'checkbox') ctx.onSetting(key, e.target.checked);
    else {
      const val = Number(e.target.value) / 100;
      ctx.onSetting(key, val);
      const out = e.target.parentElement.querySelector('output');
      if (out) out.textContent = `${e.target.value}%`;
    }
  });
  return openDialog({
    title: 'Settings',
    body,
    dismissible: true,
    actions: [{ label: 'Done', kind: 'primary', autofocus: true }],
  });
}

export function showComplete(root, { level, coins, reputation, seconds, optional, earned, hasNext }) {
  root.querySelectorAll('.complete-banner').forEach(el => el.remove());
  const badges = (level.optional || []).map(o => {
    const got = earned.includes(o.id);
    return `<span class="badge ${got ? 'earned' : 'missed'}">${got ? icon('check') : icon('x')}${escapeHtml(o.label)}</span>`;
  }).join('');
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const el = document.createElement('div');
  el.className = 'complete-banner';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Level complete');
  el.innerHTML = `
    <div class="stamp">${icon('check')}</div>
    <div class="cb-eyebrow">Level complete</div>
    <h2>${escapeHtml(level.name)}</h2>
    <p>${coins} coins in the till · ${reputation} reputation · ${mins}:${String(secs).padStart(2, '0')} on the clock.</p>
    <div class="badge-row">${badges || '<span class="badge">No bonus objectives on this map</span>'}</div>
    <div class="cb-actions">
      ${hasNext ? '<button class="btn btn-primary" data-cb="next">Next level</button>' : ''}
      <button class="btn" data-cb="replay">Replay</button>
      <button class="btn btn-quiet" data-cb="levels">Workshop trail</button>
    </div>`;
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-cb]')?.dataset.cb;
    if (!act) return;
    el.remove();
    root.dispatchEvent(new CustomEvent('lbw-complete-action', { detail: act }));
  });
  root.appendChild(el);
  setTimeout(() => (el.querySelector('button') || el).focus(), 30);
  return el;
}

export function levelNumberLabel(level) {
  if (level.town) return 'Town mode';
  return level.num === 'T' ? 'Tutorial' : `Level ${level.num}`;
}

export function levelIcon(level) {
  if (level.id === 'tutorial') return buildingIcon('washer');
  if (level.id === 'level1') return buildingIcon('press');
  if (level.id === 'level2') return buildingIcon('brewer');
  if (level.town) return buildingIcon('counter');
  return buildingIcon('freezer');
}

export { ICONS };
