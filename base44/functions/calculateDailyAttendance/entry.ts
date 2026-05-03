// Computes DailyAttendanceSummary records from AttendanceLog punches.
// Strategy: Simple Pairing (consecutive IN/OUT). Punches without a matching pair are flagged.
//
// Now incorporates:
//   - ShiftTiming master (per-employee or default) → late/early/overtime flagging + break deduction
//   - Holiday master → flags work_date as holiday and adjusts status
//
// Trigger modes:
//   - Manual (admin): POST { from_date_iso, to_date_iso } or { work_date_iso }
//   - Scheduled: no payload — processes yesterday's punches in IST

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
  return `${p.year}-${p.month}-${p.day}`;
}

function isoToDDMMYYYY(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function yesterdayIstIso() {
  const now = new Date();
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

// Get IST hour:minute (in minutes since midnight) from a UTC ISO timestamp
function istMinutesFromIso(iso) {
  const p = istPartsOf(new Date(iso));
  return Number(p.hour) * 60 + Number(p.minute);
}

// "HH:mm" → minutes since midnight
function hhmmToMinutes(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// ---------- direction inference ----------
function normalizeDirection(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === 'IN' || s === 'I' || s.includes('IN')) return 'IN';
  if (s === 'OUT' || s === 'O' || s.includes('OUT')) return 'OUT';
  return null;
}

// Shift-aware single-punch inference.
// If only ONE punch exists for the day, decide IN/OUT by which side of the shift midpoint it falls on.
// - Closer to shift start  → IN  (morning-only punch, missed OUT)
// - Closer to shift end    → OUT (evening-only punch, missed IN)
// Falls back to noon (12:00) midpoint when no shift is configured.
function inferSinglePunchDirection(punchIso, shift) {
  const punchMin = istMinutesFromIso(punchIso);
  let startMin = shift ? hhmmToMinutes(shift.start_time) : null;
  let endMin = shift ? hhmmToMinutes(shift.end_time) : null;

  if (startMin === null || endMin === null) {
    // No shift → use 12:00 noon as midpoint
    return punchMin < 12 * 60 ? 'IN' : 'OUT';
  }

  // Handle midnight-crossing shifts
  let span = endMin - startMin;
  if (span <= 0) span += 24 * 60;
  const midpoint = (startMin + span / 2) % (24 * 60);

  // Distance from punch to start vs end (circular, in minutes)
  const distTo = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 24 * 60 - d);
  };
  const dStart = distTo(punchMin, startMin);
  const dEnd = distTo(punchMin, endMin);
  void midpoint; // kept for future use
  return dStart <= dEnd ? 'IN' : 'OUT';
}

// ---------- core computation ----------
function computeSummaryForDay(employeeCode, employeeName, workDateIso, punches, shift, holiday) {
  // Sort by timestamp, then deduplicate punches that share the same timestamp (device echo / network retry).
  const sortedRaw = [...punches].sort((a, b) =>
    new Date(a.log_datetime).getTime() - new Date(b.log_datetime).getTime()
  );
  const seenTs = new Set();
  const sorted = [];
  for (const p of sortedRaw) {
    const ts = new Date(p.log_datetime).getTime();
    if (seenTs.has(ts)) continue;
    seenTs.add(ts);
    sorted.push(p);
  }

  // Special case: single punch — use shift-aware inference (morning=IN, evening=OUT)
  const singlePunchOverride = sorted.length === 1
    ? inferSinglePunchDirection(sorted[0].log_datetime, shift)
    : null;

  const resolved = sorted.map((p, idx) => {
    const dir = normalizeDirection(p.punch_direction);
    let inferred;
    if (singlePunchOverride) {
      inferred = singlePunchOverride;
    } else {
      inferred = idx % 2 === 0 ? 'IN' : 'OUT';
    }
    return {
      log_datetime: p.log_datetime,
      direction: dir || inferred,
      direction_inferred: !dir,
    };
  });

  let inCount = 0, outCount = 0;
  for (const r of resolved) {
    if (r.direction === 'IN') inCount++;
    else if (r.direction === 'OUT') outCount++;
  }

  // Simple pairing
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
    } else {
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

  // firstIn = first punch resolved as IN; lastOut = last punch resolved as OUT.
  // If none resolved as IN/OUT respectively, leave null (don't fall back to first/last raw punch — that creates phantom pairs).
  const firstIn = resolved.find((r) => r.direction === 'IN')?.log_datetime || null;
  const lastOut = [...resolved].reverse().find((r) => r.direction === 'OUT')?.log_datetime || null;
  const grossMin = (firstIn && lastOut)
    ? Math.max(0, (new Date(lastOut).getTime() - new Date(firstIn).getTime()) / 60000)
    : 0;

  // ---- shift-based flags ----
  let isLate = false;
  let isEarly = false;
  let lateMin = 0;
  let earlyMin = 0;
  let overtimeMin = 0;
  let expectedWorkMin = 0;
  let deductedBreak = 0;
  let shiftNameApplied = '';

  if (shift) {
    shiftNameApplied = shift.shift_name || '';
    const startMin = hhmmToMinutes(shift.start_time);
    const endMin = hhmmToMinutes(shift.end_time);
    const breakMin = Number(shift.break_minutes) || 0;
    const graceLate = Number(shift.grace_minutes_late) || 0;
    const graceEarly = Number(shift.grace_minutes_early) || 0;
    const otThreshold = Number(shift.overtime_threshold_minutes) || 0;

    if (startMin !== null && endMin !== null) {
      // Expected work = end - start (handle midnight crossing) - break
      let span = endMin - startMin;
      if (span <= 0) span += 24 * 60;
      expectedWorkMin = Math.max(0, span - breakMin);

      // Deduct break only if employee's gross span covers most of it
      if (totalMinutes > breakMin && breakMin > 0) {
        deductedBreak = breakMin;
        totalMinutes = Math.max(0, totalMinutes - breakMin);
      }

      if (firstIn) {
        const inMin = istMinutesFromIso(firstIn);
        const diff = inMin - startMin;
        if (diff > graceLate) {
          isLate = true;
          lateMin = diff - graceLate;
        }
      }
      if (lastOut) {
        const outMin = istMinutesFromIso(lastOut);
        // Early departure
        const earlyDiff = endMin - outMin;
        if (earlyDiff > graceEarly && earlyDiff < 12 * 60) {
          isEarly = true;
          earlyMin = earlyDiff - graceEarly;
        }
        // Overtime
        const otDiff = outMin - endMin;
        if (otDiff > otThreshold && otDiff < 12 * 60) {
          overtimeMin = otDiff - otThreshold;
        }
      }
    }
  }

  let status = 'CLEAN';
  if (sorted.length === 0) status = 'NO_PUNCHES';
  else if (unmatched.length > 0) status = 'FLAGGED';
  else if (inCount > 0 && outCount === 0) status = 'MISSING_OUT';
  else if (outCount > 0 && inCount === 0) status = 'MISSING_IN';

  // Holiday override
  if (holiday) {
    if (sorted.length === 0) status = 'HOLIDAY';
    else status = 'HOLIDAY_WORKED';
  }

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
    shift_name_applied: shiftNameApplied,
    is_holiday: !!holiday,
    holiday_name: holiday?.holiday_name || '',
    is_late_arrival: isLate,
    is_early_departure: isEarly,
    late_arrival_minutes: Math.round(lateMin * 100) / 100,
    early_departure_minutes: Math.round(earlyMin * 100) / 100,
    overtime_minutes: Math.round(overtimeMin * 100) / 100,
    expected_work_minutes: Math.round(expectedWorkMin * 100) / 100,
    deducted_break_minutes: deductedBreak,
    calculation_method: 'simple_pairing',
    calculated_at: new Date().toISOString(),
  };
}

// ---------- main handler ----------
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Use POST' }, { status: 405 });
  }

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

  let dateList = [];
  if (body.work_date_iso) {
    dateList = [body.work_date_iso];
  } else if (body.from_date_iso && body.to_date_iso) {
    dateList = enumerateDateRange(body.from_date_iso, body.to_date_iso);
  } else {
    dateList = [yesterdayIstIso()];
  }

  const base44 = createClientFromRequest(req);

  // Pre-load all active shifts and employees
  const allShifts = await base44.asServiceRole.entities.ShiftTiming.filter({ is_active: true }, 'shift_name', 200).catch(() => []);
  const shiftByName = {};
  let defaultShift = null;
  for (const s of allShifts) {
    shiftByName[s.shift_name] = s;
    if (s.is_default) defaultShift = s;
  }

  const allEmployees = await base44.asServiceRole.entities.Employee.filter({}, 'employee_code', 5000).catch(() => []);
  const empByCode = {};
  for (const e of allEmployees) empByCode[e.employee_code] = e;

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
    const ddmmyyyy = isoToDDMMYYYY(dateIso);

    // Holiday lookup for this date
    const holidayMatches = await base44.asServiceRole.entities.Holiday.filter(
      { holiday_date_iso: dateIso, is_active: true },
      '-created_date',
      5
    ).catch(() => []);
    const holiday = holidayMatches[0] || null;

    const punches = await base44.asServiceRole.entities.AttendanceLog.filter(
      { log_date: ddmmyyyy },
      '-log_datetime',
      5000
    );

    const byEmployee = {};
    for (const p of punches) {
      const code = p.employee_code;
      if (!code) continue;
      if (!byEmployee[code]) byEmployee[code] = { name: p.employee_name || '', punches: [] };
      byEmployee[code].punches.push(p);
      if (!byEmployee[code].name && p.employee_name) byEmployee[code].name = p.employee_name;
    }

    const existing = await base44.asServiceRole.entities.DailyAttendanceSummary.filter(
      { work_date_iso: dateIso },
      '-calculated_at',
      5000
    );
    const existingByEmp = {};
    for (const s of existing) existingByEmp[s.employee_code] = s;

    let dateCreated = 0, dateUpdated = 0, dateSkipped = 0;

    for (const [code, info] of Object.entries(byEmployee)) {
      // Resolve shift for this employee
      const emp = empByCode[code];
      const empShift = emp?.shift_name ? shiftByName[emp.shift_name] : null;
      const shift = empShift || defaultShift || null;

      const summary = computeSummaryForDay(code, info.name, dateIso, info.punches, shift, holiday);
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
      is_holiday: !!holiday,
      holiday_name: holiday?.holiday_name || null,
      shifts_loaded: allShifts.length,
    });
  }

  return Response.json(result, { status: 200 });
});