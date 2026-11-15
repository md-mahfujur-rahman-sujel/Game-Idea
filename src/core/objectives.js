export function evaluatePrimary(level, s) {
  const obj = level.objective;
  if (!obj) return false;
  if (s.counters.fulfilled < (obj.count || 0)) return false;
  if (obj.byType) {
    for (const [type, n] of Object.entries(obj.byType)) {
      if ((s.counters.byType[type] || 0) < n) return false;
    }
  }
  if (obj.minBase && s.counters.baseOrders < obj.minBase) return false;
  if (obj.requireObjects) {
    for (const [type, count] of Object.entries(obj.requireObjects)) {
      if (s.objects.filter(object => object.type === type).length < count) return false;
    }
  }
  return true;
}

export function evaluateOptional(obj, s) {
  switch (obj.kind) {
    case 'noCustomerLeft': return s.counters.customerLeft === 0;
    case 'underTime': return s.trackers.elapsedTicks <= obj.seconds * 10;
    case 'maxBelts': return s.counters.beltsPlaced <= obj.n;
    case 'noBlock30': return s.trackers.longestBlock < 300;
    case 'noRepLoss': return s.counters.repLoss === 0;
    case 'noMelt': return s.counters.melted === 0;
    case 'noSell': return s.counters.soldMachines === 0;
    default: return false;
  }
}

export function primaryProgress(level, s) {
  const obj = level.objective;
  const done = Math.min(s.counters.fulfilled, obj.count || 0);
  let extra = '';
  if (obj.byType) {
    const parts = Object.entries(obj.byType).map(([t, n]) => {
      const label = t === 'brewedTea' ? 'tea' : t === 'tub' ? 'ice cream' : t === 'washedPeach' ? 'peach cup' : t;
      return `${label} ${Math.min(s.counters.byType[t] || 0, n)}/${n}`;
    });
    extra = parts.join(' · ');
  } else if (obj.minBase) {
    extra = `puree ${Math.min(s.counters.baseOrders, obj.minBase)}/${obj.minBase}`;
  }
  if (obj.requireObjects) {
    const missing = Object.entries(obj.requireObjects)
      .filter(([type, count]) => s.objects.filter(object => object.type === type).length < count)
      .map(([type, count]) => `${BUILDING_LABELS[type] || type} ${s.objects.filter(object => object.type === type).length}/${count}`);
    if (missing.length) extra = [extra, ...missing].filter(Boolean).join(' · ');
  }
  return { done, total: obj.count || 0, extra };
}

const BUILDING_LABELS = { splitter: 'Splitter', merger: 'Merger', washer: 'Washers' };
