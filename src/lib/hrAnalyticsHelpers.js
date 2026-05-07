/**
 * Additional analytics helpers for HR Attrition Dashboard.
 * - Range-aware KPIs (period-scoped)
 * - Conversion funnel stages (with rates)
 * - Detailed attrition funnel (Hired → still active vs exited, broken by reason)
 * - Tenure-in-days buckets (more granular than the base helper)
 * - BI-friendly flat row export (CSV)
 */

import { daysBetween, inDateRange } from '@/lib/candidateAttritionStats';

/**
 * Detailed tenure buckets (in days) for manpower attrition.
 * Gives more granularity than the default 5-bucket view.
 */
export function buildTenureBucketsDetailed(candidates) {
  const buckets = {
    '0-7 days': 0,
    '8-15 days': 0,
    '16-30 days': 0,
    '31-60 days': 0,
    '61-90 days': 0,
    '91-180 days': 0,
    '181-365 days': 0,
    '365+ days': 0,
  };
  for (const c of candidates) {
    if (!c.enrollment_date || !c.attrition_date) continue;
    const t = daysBetween(c.enrollment_date, c.attrition_date);
    if (t === null) continue;
    if (t <= 7) buckets['0-7 days']++;
    else if (t <= 15) buckets['8-15 days']++;
    else if (t <= 30) buckets['16-30 days']++;
    else if (t <= 60) buckets['31-60 days']++;
    else if (t <= 90) buckets['61-90 days']++;
    else if (t <= 180) buckets['91-180 days']++;
    else if (t <= 365) buckets['181-365 days']++;
    else buckets['365+ days']++;
  }
  return Object.entries(buckets).map(([name, value]) => ({ name, value }));
}

/**
 * Conversion funnel: Reached → Contacted → Shortlisted → Interviewed → Hired.
 * Returns array of { stage, count, rate } where rate = stage / first stage.
 *
 * A candidate "passed" a stage if their status is at-or-beyond that stage,
 * OR they were ever moved to a later stage (status itself is the latest known).
 */
export function buildConversionFunnel(candidates) {
  const order = ['New', 'Contacted', 'Shortlisted', 'Interviewed', 'Hired', 'Terminated'];
  const rank = Object.fromEntries(order.map((s, i) => [s, i]));

  const reached = candidates.length;
  const contacted = candidates.filter((c) => (rank[c.status] ?? 0) >= rank.Contacted).length;
  const shortlisted = candidates.filter((c) => (rank[c.status] ?? 0) >= rank.Shortlisted).length;
  const interviewed = candidates.filter((c) => (rank[c.status] ?? 0) >= rank.Interviewed).length;
  const hired = candidates.filter((c) => (rank[c.status] ?? 0) >= rank.Hired).length;

  const stages = [
    { stage: 'Reached', count: reached },
    { stage: 'Contacted', count: contacted },
    { stage: 'Shortlisted', count: shortlisted },
    { stage: 'Interviewed', count: interviewed },
    { stage: 'Hired', count: hired },
  ];

  const base = reached || 1;
  return stages.map((s, i) => ({
    ...s,
    rate: base ? Math.round((s.count / base) * 1000) / 10 : 0,
    stepRate:
      i === 0
        ? 100
        : stages[i - 1].count
        ? Math.round((s.count / stages[i - 1].count) * 1000) / 10
        : 0,
  }));
}

/**
 * Detailed attrition funnel: Hired → Still Active vs Exited, with reason breakdown.
 */
export function buildAttritionFunnel(candidates) {
  const hiredOrExited = candidates.filter(
    (c) => c.status === 'Hired' || c.status === 'Terminated'
  );
  const exited = hiredOrExited.filter((c) => c.status === 'Terminated');
  const active = hiredOrExited.filter((c) => c.status === 'Hired');

  // Group exited by exit_type (fallback to attrition_reason / 'Unknown')
  const reasonMap = {};
  for (const c of exited) {
    const k = c.exit_type || c.attrition_reason || 'Unknown';
    reasonMap[k] = (reasonMap[k] || 0) + 1;
  }
  const reasons = Object.entries(reasonMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    hiredTotal: hiredOrExited.length,
    activeTotal: active.length,
    exitedTotal: exited.length,
    attritionRate: hiredOrExited.length
      ? Math.round((exited.length / hiredOrExited.length) * 1000) / 10
      : 0,
    reasons,
  };
}

/**
 * Range-aware period KPIs: stats limited to the date range
 * (uses first_contact_date for "reached", enrollment_date for "converted",
 *  attrition_date for "exited").
 */
export function computePeriodKPIs(candidates, fromISO, toISO) {
  const reached = candidates.filter((c) => inDateRange(c, 'first_contact_date', fromISO, toISO));
  const converted = candidates.filter((c) => inDateRange(c, 'enrollment_date', fromISO, toISO));
  const exited = candidates.filter((c) => inDateRange(c, 'attrition_date', fromISO, toISO));

  const conversionRate = reached.length
    ? Math.round((converted.length / reached.length) * 1000) / 10
    : 0;

  // Avg tenure for those exited within period
  const tenures = exited
    .map((c) => daysBetween(c.enrollment_date, c.attrition_date))
    .filter((n) => n !== null);
  const avgTenure = tenures.length
    ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length)
    : 0;

  return {
    reached: reached.length,
    converted: converted.length,
    exited: exited.length,
    conversionRate,
    avgTenure,
  };
}

/**
 * Build successful conversion breakdowns: among hired candidates,
 * group by source / role / location to show "what worked".
 */
export function buildConversionBreakdown(candidates, field) {
  const reachedGroups = {};
  const hiredGroups = {};
  for (const c of candidates) {
    const k = c[field] || 'Unknown';
    reachedGroups[k] = (reachedGroups[k] || 0) + 1;
    if (c.status === 'Hired' || c.status === 'Terminated') {
      hiredGroups[k] = (hiredGroups[k] || 0) + 1;
    }
  }
  return Object.entries(reachedGroups)
    .map(([name, reached]) => {
      const hired = hiredGroups[name] || 0;
      return {
        name,
        reached,
        hired,
        rate: reached ? Math.round((hired / reached) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.reached - a.reached);
}

/**
 * Convert candidate list to BI-ready flat CSV.
 * Suitable for import into Tableau / Power BI / Looker Studio.
 */
export function candidatesToCSV(candidates) {
  const headers = [
    'id',
    'candidate_name',
    'mobile_number',
    'location_area',
    'role_interested',
    'source_type',
    'source_details',
    'first_contact_mode',
    'first_contact_date',
    'status',
    'employee_code',
    'department',
    'designation',
    'enrollment_date',
    'attrition_date',
    'last_working_day',
    'exit_type',
    'attrition_reason',
    'eligible_for_rehire',
    'days_employed',
    'tenure_days_computed',
    'created_date',
  ];

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s}"`;
    return s;
  };

  const rows = candidates.map((c) => {
    const tenure =
      c.enrollment_date && c.attrition_date
        ? daysBetween(c.enrollment_date, c.attrition_date)
        : '';
    return [
      c.id,
      c.candidate_name,
      c.mobile_number,
      c.location_area,
      c.role_interested,
      c.source_type,
      c.source_details,
      c.first_contact_mode,
      c.first_contact_date,
      c.status,
      c.employee_code,
      c.department,
      c.designation,
      c.enrollment_date,
      c.attrition_date,
      c.last_working_day,
      c.exit_type,
      c.attrition_reason,
      c.eligible_for_rehire,
      c.days_employed,
      tenure,
      c.created_date,
    ]
      .map(escape)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Trigger CSV download in the browser.
 */
export function downloadCSV(csvText, filename = 'attrition-export.csv') {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}