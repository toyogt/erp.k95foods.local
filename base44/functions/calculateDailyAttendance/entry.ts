// Computes DailyAttendanceSummary records from AttendanceLog punches.
// Strategy: Simple Pairing (consecutive IN/OUT). Punches without a matching pair are flagged.
//
// Trigger modes:
//   - Manual (admin): POST { from_date_iso, to_date_iso } or { work_date_iso }
//   - Scheduled: no payload — processes yesterday's punches in IST
//
// Direction inference:
//   - Uses punch_direction if present (IN/OUT)
//   - Otherwise alternates starting with IN (1st=IN, 2nd=OUT, 3rd=IN, ...)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const IST_TZ = 'Asia/Calcutta';

// ---------- date helpers (IST) ----------
function pad2(n) { return String(n).padStart(2, '0'); }

function istPartsOf(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  return parts;
}

function istDateKeyOf(date) {
  const p = istPartsOf(date);
  return `${p.year}-${p.month}-${p.day}`; // YYYY-MM-DD
}

function isoToDDMMYYYY(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function yesterdayIstIso() {
  const now = new Date();
  // shift to IST date, then subtract 1 day
  const istKey = istDateKeyOf(now);
  const [y, m, d] = istKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const yest = new Date(utc - 24 * 60 * 60 * 1000);
  return `${yest.getUTCFullYear()}-${pad2(yest.getUTCMonth() + 1)}-${pad2(yest.getUTCDate())}`;
}

function enumerateDateRange(fromIso, toIso) {
  const out = [];
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  let cur = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (cur <= end) {
    const dt = new Date(cur);
    out.push(`${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`);
    cur += 24 * 60 * 60 * 1000;
  }
  return out;
}

// ---------- direction inference ----------
function normalizeDirection(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === 'IN' || s === 'I' || s.includes('IN')) return 'IN';
  if (s === 'OUT' || s === 'O' || s.includes('OUT')) return 'OUT';
  return null;
}

// ---------- core computation ----------
function computeSummaryForDay(employeeCode, employeeName, workDateIso, punches) {
  // punches: AttendanceLog rows, all for this employee on this IST date.
  // Sort chronologically.
  const sorted = [...punches].sort((a, b) =>
    new Date(a.log_datetime).getTime() - new Date(b.log_datetime).getTime()
  );

  // Resolve direction for each punch
  const resolved = sorted.map((p, idx) => {
    const dir = normalizeDirection(p.punch_direction);
    return {
      log_datetime: p.log_datetime,
      direction: dir || (idx % 2 === 0 ? 'IN' : 'OUT'),
      direction_inferred: !dir,
    };
  });

  let inCount = 0, outCount = 0;
  for (const r of resolved) {
    if (r.direction === 'IN') inCount++;
    else if (r.direction === 'OUT') outCount++;
  }

  // Simple pairing: walk forward. Hold an open IN; on OUT, close it.
  const pairs = [];
  const unmatched = [];
  let openIn = null;
  let totalMinutes = 0;

  for (const r of resolved) {
    if (r.direction === 'IN') {
      if (openIn) {
        unmatched.push({
          log_datetime: openIn.log_datetime,
          punch_direction: 'IN',
          reason: 'Consecutive IN without intervening OUT — earlier IN discarded',
        });
      }
      openIn = r;
    } else { // OUT
      if (openIn) {
        const dur = (new Date(r.log_datetime).getTime() - new Date(openIn.log_datetime).getTime()) / 60000;
        if (dur > 0) {
          pairs.push({
            in_time: openIn.log_datetime,
            out_time: r.log_datetime,
            duration_minutes: Math.round(dur * 100) / 100,
          });
          totalMinutes += dur;
        }
        openIn = null;
      } else {
        unmatched.push({
          log_datetime: r.log_datetime,
          punch_direction: 'OUT',
          reason: 'OUT without preceding IN',
        });
      }
    }
  }
  if (openIn) {
    unmatched.push({
      log_datetime: openIn.log_datetime,
      punch_direction: 'IN',
      reason: 'IN without matching OUT',
    });
  }

  const firstIn = sorted.find((p) => normalizeDirection(p.punch_direction) === 'IN' || p === sorted[0])?.log_datetime || null;
  const lastOut = [...sorted].reverse().find((p) => normalizeDirection(p.punch_direction) === 'OUT' || p === sorted[sorted.length - 1])?.log_datetime || null;
  const grossMin = (firstIn && lastOut)
    ? Math.max(0, (new Date(lastOut).getTime() - new Date(firstIn).getTime()) / 60000)
    : 0;

  let status = 'CLEAN';
  if (sorted.length === 0) status = 'NO_PUNCHES';
  else if (unmatched.length > 0) status = 'FLAGGED';
  else if (inCount > 0 && outCount === 0) status = 'MISSING_OUT';
  else if (outCount > 0 && inCount === 0) status = 'MISSING_IN';

  return {
    employee_code: employeeCode,
    employee_name: employeeName || '',
    work_date: isoToDDMMYYYY(workDateIso),
    work_date_iso: workDateIso,
    first_in: firstIn,
    last_out: lastOut,
    total_work_minutes: Math.round(totalMinutes * 100) / 100,
    total_work_hours: Math.round((totalMinutes / 60) * 100) / 100,
    gross_span_minutes: Math.round(grossMin * 100) / 100,
    punch_count: sorted.length,
    in_count: inCount,
    out_count: outCount,
    pairs,
    unmatched_punches: unmatched,
    status,
    calculation_method: 'simple_pairing',
    calculated_at: new Date().toISOString(),
  };
}

// ---------- main handler ----------
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Use POST' }, { status: 405 });
  }

  // Auth: admin user OR scheduled (no auth header → service-level)
  let isAdmin = false;
  let isScheduled = false;
  try {
    const base44Auth = createClientFromRequest(req);
    const u = await base44Auth.auth.me();
    if (u && u.role === 'admin') isAdmin = true;
  } catch {
    isScheduled = true;
  }

  if (!isAdmin && !isScheduled) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try { body = await req.json(); } catch { body = {}; }

  // Decide which dates to process (ISO YYYY-MM-DD in IST)
  let dateList = [];
  if (body.work_date_iso) {
    dateList = [body.work_date_iso];
  } else if (body.from_date_iso && body.to_date_iso) {
    dateList = enumerateDateRange(body.from_date_iso, body.to_date_iso);
  } else {
    dateList = [yesterdayIstIso()];
  }

  const base44 = createClientFromRequest(req);
  const result = {
    ok: true,
    dates_processed: dateList,
    summaries_created: 0,
    summaries_updated: 0,
    summaries_skipped_manual: 0,
    employees_processed: 0,
    per_date: [],
  };

  for (const dateIso of dateList) {
    // Fetch all AttendanceLog rows where log_date matches DD/MM/YYYY for this IST day
    const ddmmyyyy = isoToDDMMYYYY(dateIso);

    // Use service role to get all punches for the day
    const punches = await base44.asServiceRole.entities.AttendanceLog.filter(
      { log_date: ddmmyyyy },
      '-log_datetime',
      5000
    );

    // Group by employee_code
    const byEmployee = {};
    for (const p of punches) {
      const code = p.employee_code;
      if (!code) continue;
      if (!byEmployee[code]) byEmployee[code] = { name: p.employee_name || '', punches: [] };
      byEmployee[code].punches.push(p);
      if (!byEmployee[code].name && p.employee_name) byEmployee[code].name = p.employee_name;
    }

    // Existing summaries for this date — to update vs create
    const existing = await base44.asServiceRole.entities.DailyAttendanceSummary.filter(
      { work_date_iso: dateIso },
      '-calculated_at',
      5000
    );
    const existingByEmp = {};
    for (const s of existing) existingByEmp[s.employee_code] = s;

    let dateCreated = 0, dateUpdated = 0, dateSkipped = 0;

    for (const [code, info] of Object.entries(byEmployee)) {
      const summary = computeSummaryForDay(code, info.name, dateIso, info.punches);
      const prev = existingByEmp[code];

      if (prev) {
        if (prev.manual_override) {
          dateSkipped++;
          continue;
        }
        await base44.asServiceRole.entities.DailyAttendanceSummary.update(prev.id, summary);
        dateUpdated++;
      } else {
        await base44.asServiceRole.entities.DailyAttendanceSummary.create(summary);
        dateCreated++;
      }
    }

    result.summaries_created += dateCreated;
    result.summaries_updated += dateUpdated;
    result.summaries_skipped_manual += dateSkipped;
    result.employees_processed += Object.keys(byEmployee).length;
    result.per_date.push({
      work_date_iso: dateIso,
      work_date: ddmmyyyy,
      employees: Object.keys(byEmployee).length,
      created: dateCreated,
      updated: dateUpdated,
      skipped_manual: dateSkipped,
      total_punches: punches.length,
    });
  }

  return Response.json(result, { status: 200 });
});