import { ICONS } from './icons.js';

export const uiRoot = () => document.getElementById('ui');

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function icon(name, cls = '') {
  const svg = ICONS[name] || ICONS.info;
  return cls ? svg.replace('<svg ', `<svg class="${cls}" `) : svg;
}

// ------------------------------------------------------------------ toast

let stack = null;

function ensureStack() {
  if (stack && stack.isConnected) return stack;
  stack = document.createElement('div');
  stack.className = 'toast-stack';
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-atomic', 'false');
  uiRoot().appendChild(stack);
  return stack;
}

export function toast(title, sub = '', kind = 'info', iconName = null) {
  const root = ensureStack();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  if (kind === 'good' || kind === 'warn' || kind === 'error') kind = kind === 'good' ? 'good' : 'warn';
  const ic = iconName || (kind === 'good' ? 'check' : kind === 'warn' ? 'warn' : 'info');
  el.innerHTML = `
    <span class="tic">${icon(ic)}</span>
    <div><div>${escapeHtml(title)}</div>${sub ? `<div class="tt">${escapeHtml(sub)}</div>` : ''}</div>`;
  root.appendChild(el);
  while (root.children.length > 4) root.firstElementChild.remove();
  const kill = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  setTimeout(kill, 4200);
  return kill;
}

export function clearToasts() {
  if (stack) stack.innerHTML = '';
}

// ------------------------------------------------------------------ dialogs

const openDialogs = [];

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !openDialogs.length) return;
  const top = openDialogs[openDialogs.length - 1];
  if (top.dismissible) {
    e.preventDefault();
    e.stopPropagation();
    top.close(false);
  }
}, true);

export function openDialog({
  title,
  body = '',
  actions = [],
  dismissible = true,
  wide = false,
  label = null,
}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  if (wide) dlg.style.width = 'min(640px, 100%)';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  if (label || title) dlg.setAttribute('aria-label', label || title);

  const head = document.createElement('h2');
  head.textContent = title;
  dlg.appendChild(head);
  if (body instanceof Node) dlg.appendChild(body);
  else {
    const wrap = document.createElement('div');
    wrap.innerHTML = body;
    while (wrap.firstChild) dlg.appendChild(wrap.firstChild);
  }

  const bar = document.createElement('div');
  bar.className = 'dlg-actions';
  dlg.appendChild(bar);

  let closed = false;
  const entry = { dismissible, close: null };
  const close = (result = false) => {
    if (closed) return;
    closed = true;
    const idx = openDialogs.indexOf(entry);
    if (idx >= 0) openDialogs.splice(idx, 1);
    backdrop.remove();
    if (entry.onClose) entry.onClose(result);
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  };
  entry.close = close;
  entry.onClose = null;

  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = `btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : a.kind === 'quiet' ? 'btn-quiet' : ''}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      if (a.keepOpen) {
        if (a.onClick) a.onClick();
      } else {
        close(true);
        if (a.onClick) a.onClick();
      }
    });
    bar.appendChild(btn);
    if (a.autofocus) setTimeout(() => btn.focus(), 0);
  }
  if (!actions.length) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Close';
    btn.addEventListener('click', () => close(true));
    bar.appendChild(btn);
    setTimeout(() => btn.focus(), 0);
  }

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop && dismissible) close(false);
  });

  const previousFocus = document.activeElement;
  openDialogs.push(entry);
  backdrop.appendChild(dlg);
  uiRoot().appendChild(backdrop);

  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dlg.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  if (!actions.some(a => a.autofocus)) {
    setTimeout(() => {
      const target = dlg.querySelector('.dlg-actions .btn') || dlg;
      if (target && target.focus) target.focus({ preventScroll: true });
    }, 0);
  }

  return { close, dialog: dlg, onClose: (fn) => { entry.onClose = fn; } };
}

export function confirmAction({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const dlg = openDialog({
      title,
      body: message,
      actions: [
        { label: cancelLabel, kind: 'quiet', keepOpen: true, onClick: () => { settled = true; resolve(false); dlg.close(false); } },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', autofocus: true, keepOpen: true, onClick: () => { settled = true; resolve(true); dlg.close(true); } },
      ],
    });
    dlg.onClose(() => {
      if (!settled) resolve(false);
    });
  });
}

export function setSaveStatus(text, busy = false) {
  const chip = document.querySelector('.save-chip');
  if (!chip) return;
  chip.classList.toggle('busy', busy);
  const span = chip.querySelector('span:last-child');
  if (span) span.textContent = text;
}

export function timeAgo(ts) {
  if (!ts) return 'not yet';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
