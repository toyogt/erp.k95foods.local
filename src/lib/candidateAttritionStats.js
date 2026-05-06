/**
 * Helpers to compute recruitment funnel and attrition statistics
 * from CandidateLead records.
 */

export function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export function formatDateDDMMYYYY(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Filter candidates by a date-range on a given ISO field */
export function inDateRange(candidate, field, fromISO, toISO) {
  const v = candidate[field];
  if (!v) return false;
  if (fromISO && v < fromISO) return false;
  if (toISO && v > toISO) return false;
  return true;
}

/** Group candidates by an ISO date field → { 'YYYY-MM-DD': count } */
export function groupByDate(candidates, field) {
  const map = {};
  for (const c of candidates) {
    const v = c[field];
    if (!v) continue;
    const key = String(v).slice(0, 10);
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

/** Build a daily series between two ISO dates from a count map */
export function buildDailySeries(countMap, fromISO, toISO) {
  if (!fromISO || !toISO) return [];
  const out = [];
  const start = new Date(fromISO);
  const end = new Date(toISO);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: countMap[key] || 0 });
  }
  return out;
}

/** Aggregate counts by a categorical field */
export function groupByCategory(candidates, field) {
  const map = {};
  for (const c of candidates) {
    const k = c[field] || 'Unknown';
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Compute summary KPIs for the given candidate list */
export function computeKPIs(candidates) {
  const total = candidates.length;
  const hired = candidates.filter((c) => c.status === 'Hired' || c.status === 'Terminated').length;
  const terminated = candidates.filter((c) => c.status === 'Terminated').length;
  const active = candidates.filter((c) => c.status === 'Hired').length;
  const conversionRate = total ? (hired / total) * 100 : 0;
  const attritionRate = hired ? (terminated / hired) * 100 : 0;

  // Avg tenure (days)
  const tenures = candidates
    .filter((c) => c.enrollment_date && c.attrition_date)
    .map((c) => daysBetween(c.enrollment_date, c.attrition_date))
    .filter((n) => n !== null);
  const avgTenure = tenures.length
    ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length)
    : 0;

  // Tenure buckets
  const buckets = { '0-7': 0, '8-30': 0, '31-90': 0, '91-180': 0, '180+': 0 };
  for (const t of tenures) {
    if (t <= 7) buckets['0-7']++;
    else if (t <= 30) buckets['8-30']++;
    else if (t <= 90) buckets['31-90']++;
    else if (t <= 180) buckets['91-180']++;
    else buckets['180+']++;
  }

  return {
    total,
    hired,
    active,
    terminated,
    conversionRate,
    attritionRate,
    avgTenure,
    tenureBuckets: Object.entries(buckets).map(([name, value]) => ({ name, value })),
  };
}