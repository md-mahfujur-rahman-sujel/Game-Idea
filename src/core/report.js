// Live diagnostics for the workshop. This module is deliberately free of DOM,
// canvas and timers so the report can be unit-tested and reused by any client.
// It answers three player questions at a glance:
//   1. Is anything stuck right now, and where?
//   2. How much is actually reaching the counter?
//   3. Is the cold chain healthy?

import { BUILDINGS, SIM } from '../data/buildings.js';
import { ITEMS, itemName } from '../data/items.js';
import { findOrderFor } from './sim.js';

const unique = list => [...new Set(list)];

function since(ticks) {
  const seconds = Math.floor(Math.max(0, ticks) / 10);
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function laneNames(lanes) {
  return unique(lanes.map(lane => itemName(lane.item))).join(' and ');
}

function itemNames(items) {
  return unique(items.map(item => itemName(item.type))).join(' and ');
}

function scanContainers(s, type) {
  let count = 0;
  for (const belt of Object.values(s.belts || {})) {
    if (belt.item?.type === type) count++;
  }
  for (const o of s.objects || []) {
    if (o.output?.some(it => it.type === type)) count += o.output.filter(it => it.type === type).length;
    for (const sock of o.inputs || []) count += sock.buf.filter(it => it.type === type).length;
    for (const lane of o.lanes || []) count += lane.buf.filter(it => it.type === type).length;
  }
  return count;
}

function machineIssues(s) {
  const issues = [];
  for (const o of s.objects || []) {
    const def = BUILDINGS[o.type];
    if (def?.kind !== 'machine' || o.state !== 'blocked') continue;
    issues.push({
      tone: 'blocked',
      title: `${def.name} cannot empty`,
      detail: `${o.reason || 'Its output is full'} · blocked for ${since(o.blockedStreak)}.`,
      jump: { kind: 'object', id: o.id },
      weight: 110 + Math.min(89, (o.blockedStreak || 0) / 10),
    });
  }
  return issues;
}

function counterIssues(s) {
  const issues = [];
  for (const o of s.objects || []) {
    const def = BUILDINGS[o.type];
    if (def?.kind !== 'counter') continue;
    const buf = o.inputs?.[0]?.buf || [];
    if (!buf.length) continue;

    const unwanted = buf.filter(it => !findOrderFor(s, it.type));
    if (unwanted.length) {
      const names = itemNames(unwanted);
      issues.push({
        tone: 'blocked',
        title: `Counter is holding ${names}`,
        detail: `No waiting order wants this. The belt behind the counter will back up until you discard it.`,
        jump: { kind: 'object', id: o.id },
        weight: 130 + unwanted.length,
      });
      continue;
    }

    if (buf.length >= o.outCap) {
      issues.push({
        tone: 'blocked',
        title: 'Counter buffer is full',
        detail: `${buf.length} / ${o.outCap} slots used. Serve a waiting order or discard something to make room.`,
        jump: { kind: 'object', id: o.id },
        weight: 100,
      });
    }
  }
  return issues;
}

function sourceIssues(s) {
  const issues = [];
  for (const o of s.objects || []) {
    const def = BUILDINGS[o.type];
    if (def?.kind !== 'source') continue;
    // Cream is bought by hand; a full dairy lane is expected, not a jam.
    const stuck = (o.lanes || []).filter(lane => !lane.manual && lane.buf.length >= lane.buffer);
    if (!stuck.length) continue;
    issues.push({
      tone: 'blocked',
      title: `${def.name} cannot empty`,
      detail: `${laneNames(stuck)} ${stuck.length === 1 ? 'is' : 'are'} waiting because the output lane is full. Nothing downstream is being fed.`,
      jump: { kind: 'object', id: o.id },
      weight: 90 + stuck.length,
    });
  }
  return issues;
}

function beltIssues(s) {
  const groups = new Map();
  for (const belt of Object.values(s.belts || {})) {
    if (!belt.item?.blocked) continue;
    const reason = belt.item.blockedReason || 'Something ahead is full';
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(belt);
  }

  const issues = [];
  for (const [reason, belts] of groups) {
    belts.sort((a, b) => a.x - b.x || a.y - b.y);
    const first = belts[0];
    issues.push({
      tone: 'blocked',
      title: `Belt jam · ${reason}`,
      detail: `${belts.length} belt tile${belts.length === 1 ? '' : 's'} stuck · first at ${first.x}, ${first.y}.`,
      jump: { kind: 'belt', x: first.x, y: first.y },
      weight: 80 + Math.min(50, belts.length),
    });
  }
  return issues;
}

function waitingMachines(s) {
  const waiting = [];
  for (const o of s.objects || []) {
    const def = BUILDINGS[o.type];
    if (def?.kind !== 'machine') continue;
    if (o.state !== 'idle' || o.recipe) continue;
    if ((o.idleStreak || 0) < 30) continue;
    waiting.push({
      id: o.id,
      name: def.name,
      reason: o.reason || 'Waiting for an ingredient',
      seconds: Math.floor(o.idleStreak / 10),
      jump: { kind: 'object', id: o.id },
    });
  }
  return waiting.sort((a, b) => b.seconds - a.seconds).slice(0, 4);
}

function buildTip(data) {
  const top = data.issues[0];
  if (top) return `Start with "${top.title}". The Go button jumps straight to it.`;

  if (data.cold.nextMeltSeconds != null && data.cold.nextMeltSeconds <= 15) {
    return 'A tub has under 15 seconds of chill left. Serve it before starting another batch.';
  }
  if (data.cold.melted > 0) {
    return 'Melted mix can be refrozen twice, but each cycle leaves less chill. Removing it is often cheaper than a lost order.';
  }
  if (data.cold.tubsOnBelts > 0) {
    return 'Tubs only age on belts. Keep the run to the counter short, or leave the output parked in the freezer.';
  }
  if (data.waiting.length) {
    return `${data.waiting[0].name} has been waiting ${data.waiting[0].seconds}s. Follow its empty socket back to the supply that feeds it.`;
  }
  if (data.elapsedSeconds >= 20 && data.ordersServed === 0) {
    return 'Nothing has reached the counter yet. Follow a line from a source and check each socket it crosses.';
  }
  if (data.elapsedSeconds < 20) {
    return 'The first customer arrives in about 16 seconds. Make sure a belt reaches the counter before then.';
  }
  if (!data.belts.tiles) {
    return 'No belts yet. Belts move one item per second, and every machine needs one on its output side to drain.';
  }
  return 'The line is flowing. Add capacity where the longest wait is, not just more machines.';
}

export function buildReport(s, level) {
  const elapsedTicks = Math.max(0, s?.trackers?.elapsedTicks || 0);
  const elapsedSeconds = elapsedTicks / 10;
  const minutes = elapsedSeconds / 60;
  const nextMeltValues = [];

  const belts = Object.values(s?.belts || {});
  for (const belt of belts) {
    if (belt.item?.type === 'tub' && belt.item.fresh != null) nextMeltValues.push(belt.item.fresh);
  }

  const delivered = Object.entries(s?.counters?.byType || {})
    .filter(([type, count]) => ITEMS[type] && count > 0)
    .map(([type, count]) => ({ type, name: itemName(type), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const totalDelivered = delivered.reduce((sum, item) => sum + item.count, 0);

  const machines = (s?.objects || []).filter(o => BUILDINGS[o.type]?.kind === 'machine');
  const beltsBlocked = belts.filter(belt => belt.item?.blocked);
  const tubsOnBelts = belts.filter(belt => belt.item?.type === 'tub').length;
  const meltedOnLine = scanContainers(s, 'melted');
  const activeOrders = (s?.orders?.active || []).filter(o => !o.errand);
  const nextMeltTicks = nextMeltValues.length ? Math.min(...nextMeltValues) : null;

  const issues = [
    ...counterIssues(s),
    ...machineIssues(s),
    ...sourceIssues(s),
    ...beltIssues(s),
  ].sort((a, b) => b.weight - a.weight);

  const data = {
    elapsedTicks,
    elapsedSeconds,
    minutes,
    coins: s?.coins ?? 0,
    reputation: s?.reputation ?? 0,
    ordersServed: s?.counters?.fulfilled || 0,
    ordersPerMinute: minutes > 0.1 ? (s?.counters?.fulfilled || 0) / minutes : 0,
    activeOrders: activeOrders.length,
    urgentOrders: activeOrders.filter(o => o.remaining <= o.patienceMax * 10 * 0.25).length,
    delivered,
    totalDelivered,
    machines: {
      total: machines.length,
      working: machines.filter(o => o.state === 'working').length,
      blocked: machines.filter(o => o.state === 'blocked').length,
      idle: machines.filter(o => o.state === 'idle').length,
    },
    belts: {
      tiles: belts.length,
      placed: s?.counters?.beltsPlaced || 0,
      inTransit: belts.filter(belt => belt.item).length,
      blocked: beltsBlocked.length,
    },
    cold: {
      tubsDelivered: s?.counters?.byType?.tub || 0,
      melted: s?.counters?.melted || 0,
      tubsOnBelts,
      meltedOnLine,
      nextMeltSeconds: nextMeltTicks == null ? null : Math.max(1, Math.ceil(nextMeltTicks / 10)),
      tubsAtRisk: nextMeltValues.filter(fresh => fresh <= SIM.coldWarnTicks).length,
      creamLeft: level?.creamCap > 0 ? Math.max(0, level.creamCap - (s?.creamBought || 0)) : null,
    },
    issues,
    waiting: waitingMachines(s),
  };
  data.tip = buildTip(data);
  return data;
}
