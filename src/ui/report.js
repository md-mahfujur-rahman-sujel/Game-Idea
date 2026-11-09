// The workshop report dialog. It renders a paused snapshot of the line with
// one-click jumps to every problem, so "why is nothing moving?" has a concrete
// answer instead of a hunt across the map.

import { buildReport } from '../core/report.js';
import { ITEMS } from '../data/items.js';
import { icon, openDialog, escapeHtml } from './dom.js';
import { itemIcon } from './icons.js';

function clock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function jumpButton(actions, jump, label = 'Go') {
  if (!jump) return '';
  const index = actions.push(jump) - 1;
  return `<button class="btn btn-sm btn-quiet" data-report-jump="${index}">${icon('arrow')} ${label}</button>`;
}

function kpi(value, label, sub, tone = '') {
  return `<div class="report-kpi ${tone}">
    <span class="v">${escapeHtml(String(value))}</span>
    <span class="l">${escapeHtml(label)}</span>
    <span class="s">${escapeHtml(sub)}</span>
  </div>`;
}

function issueRow(issue, actions, tone = issue.tone) {
  return `<div class="report-issue ${tone}">
    <span class="ri-ic">${icon(tone === 'waiting' ? 'clock' : 'warn')}</span>
    <span class="ri-main">
      <span class="ri-title">${escapeHtml(issue.title)}</span>
      <span class="ri-detail">${escapeHtml(issue.detail)}</span>
    </span>
    ${jumpButton(actions, issue.jump)}
  </div>`;
}

function deliveredRows(data) {
  if (!data.delivered.length) {
    return '<div class="report-empty">Nothing has reached the counter yet.</div>';
  }
  const top = Math.max(1, ...data.delivered.map(item => item.count));
  return `<div class="report-delivered">${data.delivered.map(item => `
    <div class="report-del-row">
      <span class="rd-ic">${itemIcon(item.type, ITEMS)}</span>
      <span class="rd-name">${escapeHtml(item.name)}</span>
      <span class="rd-track" aria-hidden="true"><i style="width:${Math.round((item.count / top) * 100)}%"></i></span>
      <span class="rd-count">${item.count}</span>
    </div>`).join('')}</div>`;
}

function coldSection(data) {
  const { cold } = data;
  const show = cold.creamLeft != null
    || cold.tubsDelivered > 0
    || cold.melted > 0
    || cold.tubsOnBelts > 0
    || cold.nextMeltSeconds != null;
  if (!show) return '';

  const tiles = [
    { value: cold.tubsDelivered, label: 'Tubs delivered' },
    { value: cold.melted, label: 'Melt events' },
    {
      value: cold.nextMeltSeconds == null ? '—' : `${cold.nextMeltSeconds}s`,
      label: 'Next melt',
      tone: cold.nextMeltSeconds != null && cold.nextMeltSeconds <= 15 ? 'bad' : '',
    },
    cold.creamLeft == null
      ? { value: cold.tubsOnBelts, label: 'Tubs on belts' }
      : { value: cold.creamLeft, label: 'Cream left', tone: cold.creamLeft === 0 ? 'bad' : '' },
  ];

  let notes = '';
  if (cold.tubsAtRisk) {
    notes += `<div class="note-line warn">${cold.tubsAtRisk} tub${cold.tubsAtRisk === 1 ? '' : 's'} below 15 seconds of chill. Serve or park ${cold.tubsAtRisk === 1 ? 'it' : 'them'} first.</div>`;
  }
  if (cold.meltedOnLine) {
    notes += `<div class="note-line warn">${cold.meltedOnLine} Melted Mix on the line. Re-freeze it twice at most, or remove it before it clears on its own.</div>`;
  }
  if (cold.creamLeft === 0) {
    notes += '<div class="note-line warn">No cream buys left this level. Restart from the pause menu to get the budget back.</div>';
  }

  return `<section class="report-sec">
    <h3>${icon('snow')} Cold chain</h3>
    <div class="report-mini">
      ${tiles.map(t => `<div class="${t.tone || ''}"><span class="v">${escapeHtml(String(t.value))}</span><span class="l">${escapeHtml(t.label)}</span></div>`).join('')}
    </div>
    ${notes}
  </section>`;
}

function reportHtml(data, level, actions, levelDone) {
  const rate = data.elapsedSeconds >= 15 ? data.ordersPerMinute.toFixed(1) : '—';
  const stuckTone = data.issues.length ? 'bad' : 'good';
  const stuckSub = data.issues.length
    ? 'needs a look'
    : (data.belts.tiles || data.machines.total ? 'line clear' : 'nothing built yet');

  const issues = data.issues.length
    ? data.issues.map(issue => issueRow(issue, actions)).join('')
    : `<div class="report-empty good">${icon('check')} Nothing is blocked right now.</div>`;

  const waiting = data.waiting.length
    ? `<section class="report-sec">
        <h3>${icon('clock')} Waiting for supplies</h3>
        ${data.waiting.map(item => issueRow({
          title: `${item.name} is idle`,
          detail: `${item.reason} · waiting ${item.seconds}s.`,
          jump: item.jump,
        }, actions, 'waiting')).join('')}
      </section>`
    : '';

  return `
    <p class="report-lead">${
      levelDone
        ? 'The workshop is complete. This is the final report.'
        : 'The workshop is paused while this report is open. Close it to carry on.'
    }</p>
    <div class="report-kpis">
      ${kpi(data.ordersServed, 'Orders served', `${rate} per minute`)}
      ${kpi(data.totalDelivered, 'Items delivered', data.delivered.length ? `${data.delivered.length} kinds` : 'none yet')}
      ${kpi(data.issues.length, 'Stuck now', stuckSub, stuckTone)}
      ${kpi(data.coins, 'Coins', `${data.reputation} reputation`)}
    </div>
    <div class="report-meta">
      <span>${icon('clock')} ${clock(data.elapsedSeconds)}</span>
      <span>${icon('orders')} ${data.activeOrders} / 3 waiting${data.urgentOrders ? ` · ${data.urgentOrders} urgent` : ''}</span>
      <span>${icon('grid')} ${data.belts.tiles} belt tile${data.belts.tiles === 1 ? '' : 's'}</span>
      <span>${icon('warn')} ${data.belts.blocked} blocked</span>
    </div>

    <section class="report-sec">
      <h3>${icon('warn')} Where the line is stuck</h3>
      ${issues}
    </section>

    ${waiting}

    <section class="report-sec">
      <h3>${icon('orders')} Delivered</h3>
      ${deliveredRows(data)}
    </section>

    ${coldSection(data)}

    <div class="report-tip ${data.issues.length ? 'warn' : 'good'}">
      ${icon('sparkle')} <span>${escapeHtml(data.tip)}</span>
    </div>`;
}

export function openReport(ctrl) {
  if (!ctrl?.s || !ctrl?.level) return;
  ctrl.hud?.closeSheet?.();

  const data = buildReport(ctrl.s, ctrl.level);
  const actions = [];
  const body = document.createElement('div');
  body.className = 'report';
  body.innerHTML = reportHtml(data, ctrl.level, actions, ctrl.s.levelDone);

  let resume = false;
  if (!ctrl.s.paused && !ctrl.s.levelDone) {
    ctrl.s.paused = true;
    resume = true;
    ctrl.hud?.refresh();
  }

  const dlg = openDialog({
    title: 'Workshop report',
    body,
    wide: true,
    actions: [{ label: 'Close report', kind: 'primary', autofocus: true }],
  });
  dlg.dialog.classList.add('report-dialog');

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-report-jump]');
    if (!btn) return;
    const target = actions[Number(btn.dataset.reportJump)] || null;
    dlg.close(true);
    if (target) ctrl.jumpTo(target);
  });

  dlg.onClose(() => {
    if (resume && ctrl.s && !ctrl.s.levelDone) {
      ctrl.s.paused = false;
      ctrl.hud?.refresh();
    }
  });
}
