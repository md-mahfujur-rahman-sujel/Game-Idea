import { openDialog, escapeHtml } from './dom.js';
import {
  ensureTown, xpToNext, MAX_TOWN_LEVEL, storyStatus, dailyProgress, ensureDaily,
  nextExpansion, canExpand, EXPANSIONS, UNLOCK_NOTES,
} from '../core/town.js';

function bar(have, need) {
  const pct = need > 0 ? Math.round((have / need) * 100) : 100;
  return `<div class="progress-bar" style="margin:4px 0 2px"><i style="width:${pct}%"></i></div>`;
}

function section(title, inner) {
  return `<section style="margin:0 0 14px"><div class="cat" style="margin:0 0 6px">${escapeHtml(title)}</div>${inner}</section>`;
}

function render(ctrl) {
  const profile = ensureTown(ctrl.doc.profile);
  ensureDaily(profile);
  const s = ctrl.s;
  const lv = profile.townLevel;
  const need = xpToNext(lv);
  const maxed = lv >= MAX_TOWN_LEVEL;

  let html = section('Town Level', `
    <div style="font-weight:700;font-size:18px">Level ${lv}${maxed ? ' · max' : ''}</div>
    ${maxed ? '' : `${bar(profile.xp, need)}<div class="ctx-sub">${profile.xp} / ${need} xp to Level ${lv + 1}</div>`}
    <div class="ctx-sub">Landmark stage ${profile.landmark} · ${profile.permits} Expansion Permit${profile.permits === 1 ? '' : 's'}</div>`);

  const st = storyStatus(profile);
  html += section('Story', st.done
    ? `<div class="ctx-sub">${escapeHtml(st.text)}</div>`
    : st.locked
      ? `<div style="font-weight:700">${escapeHtml(st.title)}</div><div class="ctx-sub">${escapeHtml(st.text)}</div>`
      : `<div style="font-weight:700">${escapeHtml(st.title)} <span class="ctx-sub">· ${escapeHtml(st.who)} · step ${st.stepNo}/${st.steps}</span></div>
         <div>${escapeHtml(st.text)}</div>${bar(st.have, st.need)}<div class="ctx-sub">${st.have} / ${st.need}</div>`);

  const d = profile.daily;
  const goals = d.goals.map((g, i) => {
    const have = dailyProgress(profile, g);
    const ready = have >= g.target && !g.claimed;
    return `<div class="item-row" style="align-items:center">
      <span class="nm" style="flex:1">${escapeHtml(g.label)}<br><span class="ctx-sub">${have} / ${g.target}</span></span>
      ${g.claimed ? '<span class="fresh chilled">claimed</span>'
        : `<button class="btn btn-sm ${ready ? 'btn-primary' : ''}" data-town="claim" data-index="${i}" ${ready ? '' : 'disabled'}>Claim</button>`}
    </div>`;
  }).join('');
  const allClaimed = d.goals.every(g => g.claimed);
  html += section(`Daily goals · streak ${d.streak} day${d.streak === 1 ? '' : 's'}`, `${goals}
    <div class="ctx-actions"><button class="btn btn-sm ${allClaimed && !d.chestClaimed ? 'btn-primary' : ''}" data-town="chest" ${allClaimed && !d.chestClaimed ? '' : 'disabled'}>${d.chestClaimed ? 'Daily gift claimed' : 'Open the daily gift'}</button></div>
    <div class="ctx-sub">Missing a day only pauses the streak. Every third day the gift includes a permit.</div>`);

  const cur = EXPANSIONS[profile.expansion];
  const next = nextExpansion(profile);
  let land = `<div>${escapeHtml(cur.name)}</div>`;
  if (next) {
    const check = canExpand(profile, s ? s.coins : 0);
    land += `<div class="ctx-sub">Next: ${escapeHtml(next.name)} · Town Level ${next.level} · ${next.coins} coins · ${next.permits} permit${next.permits > 1 ? 's' : ''}</div>
      <div class="ctx-actions"><button class="btn btn-sm ${check.ok ? 'btn-primary' : ''}" data-town="expand" ${check.ok ? '' : 'disabled'}>Expand the town</button></div>
      ${check.ok ? '' : `<div class="ctx-sub">${escapeHtml(check.reason)}</div>`}`;
  } else {
    land += '<div class="ctx-sub">The whole town is open.</div>';
  }
  html += section('Land', land);

  const upcoming = Object.keys(UNLOCK_NOTES).map(Number).filter(n => n > lv).sort((a, b) => a - b).slice(0, 3);
  if (upcoming.length) {
    html += section('Coming up', upcoming.map(n => `<div class="ctx-sub"><b>Level ${n}:</b> ${escapeHtml(UNLOCK_NOTES[n].join(' · '))}</div>`).join(''));
  }
  return html;
}

export function openTownDialog(ctrl) {
  const body = document.createElement('div');
  const paint = () => { body.innerHTML = render(ctrl); };
  paint();
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-town]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.town;
    if (act === 'claim') ctrl.claimDailyGoal(Number(btn.dataset.index));
    else if (act === 'chest') ctrl.claimDailyChest();
    else if (act === 'expand') ctrl.expandTown();
    paint();
  });
  return openDialog({
    title: 'Little Batch Town',
    body,
    wide: true,
    dismissible: true,
    actions: [{ label: 'Close', kind: 'primary', autofocus: true }],
  });
}
