/**
 * Delegation Score Engine
 *
 * Calculates per-task scoring cycles and person-wise aggregates.
 *
 * KEY CONCEPT — Scoring Cycle:
 *  One task can have multiple scoring cycles. A new cycle starts when a
 *  date-change shifts the task to another Monday–Sunday week.
 *  The old cycle is closed as "week_shifted" with penalty 2 (Red).
 *  The new cycle starts fresh at penalty 0 (Green).
 *
 * Penalty levels: 0 = Green, 1 = Yellow, 2 = Red (capped at 2).
 */

import moment from 'moment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse DD/MM/YYYY → moment (start of day) */
function parseDDMMYYYY(str) {
  if (!str) return null;
  const m = moment(str, 'DD/MM/YYYY', true);
  return m.isValid() ? m.startOf('day') : null;
}

/** Get ISO week start (Monday) for a moment date */
function weekStart(m) {
  return m.clone().startOf('isoWeek'); // Monday
}

/** Get ISO week end (Sunday) for a moment date */
function weekEnd(m) {
  return m.clone().endOf('isoWeek'); // Sunday
}

/** Check if two dates are in the same Monday–Sunday week */
function sameWeek(dateA, dateB) {
  if (!dateA || !dateB) return true;
  return weekStart(dateA).isSame(weekStart(dateB), 'day');
}

/** Format moment to DD/MM/YYYY */
function fmtDate(m) {
  return m ? m.format('DD/MM/YYYY') : '—';
}

// ─── Core scoring ─────────────────────────────────────────────────────────────

/**
 * Build scoring cycles for a single task from its log entries.
 *
 * @param {Object}   task  – DirectorTask record
 * @param {Object[]} logs  – DirectorTaskLog records for this task, sorted by timestamp ASC
 * @param {moment}   today – "now" moment (start of day) for overdue calc
 * @returns {Object[]} array of scoring-cycle objects
 */
export function buildScoringCycles(task, logs, today) {
  if (!today) today = moment().startOf('day');

  // 1. Derive original due date from the "created" log
  const createdLog = logs.find(l => l.action === 'created');
  let originalDueDate = parseDDMMYYYY(task.end_date);
  if (createdLog) {
    // details format: 'Task "X" assigned to Y, due DD/MM/YYYY'
    const match = createdLog.details?.match(/due\s+(\d{2}\/\d{2}\/\d{4})/);
    if (match) {
      const parsed = parseDDMMYYYY(match[1]);
      if (parsed) originalDueDate = parsed;
    }
  }

  // 2. Collect all date-change events (requested, approved, rejected — all count)
  //    DE-DUPLICATE: If request + approved/rejected share the same old→new dates,
  //    count them as ONE logical date-change event, not two.
  const rawDateChangeEvents = logs
    .filter(l => ['date_change_requested', 'date_change_approved', 'date_change_rejected'].includes(l.action))
    .map(l => ({
      action: l.action,
      oldDate: parseDDMMYYYY(l.old_value),
      newDate: parseDDMMYYYY(l.new_value),
      timestamp: moment(l.timestamp),
      oldStr: l.old_value,
      newStr: l.new_value,
    }))
    .filter(e => e.oldDate && e.newDate);

  // De-duplicate: group by old_value+new_value, keep earliest timestamp
  const dedupeMap = new Map();
  for (const evt of rawDateChangeEvents) {
    const key = `${evt.oldStr}|${evt.newStr}`;
    if (!dedupeMap.has(key) || evt.timestamp.isBefore(dedupeMap.get(key).timestamp)) {
      dedupeMap.set(key, evt);
    }
  }
  const dateChangeEvents = Array.from(dedupeMap.values());

  // Also pick up direct "edited" logs where old_value/new_value look like dates
  const editedDateChanges = logs
    .filter(l => l.action === 'edited' && l.old_value && l.new_value)
    .filter(l => parseDDMMYYYY(l.old_value) && parseDDMMYYYY(l.new_value))
    .map(l => ({
      action: 'date_change_requested', // treat as date change for scoring
      oldDate: parseDDMMYYYY(l.old_value),
      newDate: parseDDMMYYYY(l.new_value),
      timestamp: moment(l.timestamp),
      oldStr: l.old_value,
      newStr: l.new_value,
    }))
    // Also dedupe against existing date change events
    .filter(e => !dedupeMap.has(`${e.oldStr}|${e.newStr}`));

  const allDateChanges = [...dateChangeEvents, ...editedDateChanges]
    .sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

  // 3. Build cycles — walk through date changes and split on week shifts
  const cycles = [];
  let cycleDueDate = originalDueDate;
  let cycleStartDate = originalDueDate ? weekStart(originalDueDate) : null;
  let cycleEndDate = originalDueDate ? weekEnd(originalDueDate) : null;
  let sameWeekChangeCount = 0;
  let dateChangeRequestsInCycle = [];

  const closeCycle = (status, weekShifted) => {
    const dateChangePenalty = Math.min(sameWeekChangeCount >= 2 ? 2 : sameWeekChangeCount, 2);
    const weekShiftPenalty = weekShifted ? 2 : 0;
    const finalPenalty = Math.min(Math.max(dateChangePenalty, weekShiftPenalty), 2);

    cycles.push({
      task_id: task.id,
      task_number: task.task_number,
      task_name: task.task_name,
      assigned_to_email: task.assigned_to_email,
      assigned_to_name: task.assigned_to_name || task.assigned_to_email,
      director_email: task.director_email,
      director_name: task.director_name,
      original_due_date: originalDueDate ? fmtDate(originalDueDate) : '—',
      current_due_date: task.end_date,
      task_status: task.status,
      completed_at: task.completed_at || null,
      cycle_due_date: cycleDueDate ? fmtDate(cycleDueDate) : '—',
      cycle_week_start: cycleStartDate ? fmtDate(cycleStartDate) : '—',
      cycle_week_end: cycleEndDate ? fmtDate(cycleEndDate) : '—',
      cycle_status: status,
      week_shifted: weekShifted,
      same_week_change_count: sameWeekChangeCount,
      date_change_count: dateChangeRequestsInCycle.length,
      date_change_events: dateChangeRequestsInCycle,
      // Penalties calculated below or overridden
      date_change_penalty: Math.min(sameWeekChangeCount >= 2 ? 2 : sameWeekChangeCount, 2),
      week_shift_penalty: weekShiftPenalty,
      unmanaged_overdue_penalty: 0, // will be set later for active cycle
      unmanaged_overdue_days: 0,
      final_penalty: finalPenalty,
      task_health: finalPenalty === 0 ? 'Green' : finalPenalty === 1 ? 'Yellow' : 'Red',
    });
  };

  // Walk date-change events and split into cycles
  for (const evt of allDateChanges) {
    if (!cycleDueDate) {
      cycleDueDate = evt.oldDate;
      cycleStartDate = weekStart(evt.oldDate);
      cycleEndDate = weekEnd(evt.oldDate);
    }

    const isWeekShift = !sameWeek(evt.oldDate, evt.newDate);

    if (isWeekShift) {
      // Close old cycle as week-shifted
      dateChangeRequestsInCycle.push(evt);
      closeCycle('week_shifted', true);

      // Start new cycle
      cycleDueDate = evt.newDate;
      cycleStartDate = weekStart(evt.newDate);
      cycleEndDate = weekEnd(evt.newDate);
      sameWeekChangeCount = 0;
      dateChangeRequestsInCycle = [];
    } else {
      // Same-week change
      sameWeekChangeCount += 1;
      dateChangeRequestsInCycle.push(evt);
    }
  }

  // 4. Close the final (active) cycle
  const taskDone = task.status === 'completed' || task.status === 'cancelled';
  const currentDue = parseDDMMYYYY(task.end_date);

  // If we never created an initial cycle due date, use current
  if (!cycleDueDate && currentDue) {
    cycleDueDate = currentDue;
    cycleStartDate = weekStart(currentDue);
    cycleEndDate = weekEnd(currentDue);
  }

  // Calculate unmanaged overdue penalty for the active cycle
  let unmanagedOverdueDays = 0;
  let unmanagedOverduePenalty = 0;

  if (!taskDone && currentDue) {
    const daysPastDue = today.diff(currentDue, 'days'); // positive = overdue

    if (daysPastDue > 0) {
      // Check if any date-change request covers this due date
      const hasDateChangeForDue = dateChangeRequestsInCycle.length > 0;

      if (!hasDateChangeForDue) {
        unmanagedOverdueDays = daysPastDue;
        unmanagedOverduePenalty = daysPastDue >= 2 ? 2 : 1;
      }
    }
  }

  // Final active cycle
  const activeDateChangePenalty = Math.min(sameWeekChangeCount >= 2 ? 2 : sameWeekChangeCount, 2);
  const activeWeekShiftPenalty = 0; // active cycle was not week-shifted
  const activeFinal = Math.min(Math.max(activeDateChangePenalty, activeWeekShiftPenalty, unmanagedOverduePenalty), 2);

  const activeStatus = taskDone ? 'completed' : 'active';

  cycles.push({
    task_id: task.id,
    task_number: task.task_number,
    task_name: task.task_name,
    assigned_to_email: task.assigned_to_email,
    assigned_to_name: task.assigned_to_name || task.assigned_to_email,
    director_email: task.director_email,
    director_name: task.director_name,
    original_due_date: originalDueDate ? fmtDate(originalDueDate) : '—',
    current_due_date: task.end_date,
    task_status: task.status,
    completed_at: task.completed_at || null,
    cycle_due_date: cycleDueDate ? fmtDate(cycleDueDate) : task.end_date,
    cycle_week_start: cycleStartDate ? fmtDate(cycleStartDate) : '—',
    cycle_week_end: cycleEndDate ? fmtDate(cycleEndDate) : '—',
    cycle_status: activeStatus,
    week_shifted: false,
    same_week_change_count: sameWeekChangeCount,
    date_change_count: dateChangeRequestsInCycle.length,
    date_change_events: dateChangeRequestsInCycle,
    date_change_penalty: activeDateChangePenalty,
    week_shift_penalty: activeWeekShiftPenalty,
    unmanaged_overdue_penalty: unmanagedOverduePenalty,
    unmanaged_overdue_days: unmanagedOverdueDays,
    final_penalty: activeFinal,
    task_health: activeFinal === 0 ? 'Green' : activeFinal === 1 ? 'Yellow' : 'Red',
  });

  return cycles;
}

// ─── Filter cycles by selected date range ─────────────────────────────────────

/**
 * Returns true if this scoring cycle is relevant for the given date window.
 */
export function cycleMatchesRange(cycle, rangeStart, rangeEnd) {
  const ws = parseDDMMYYYY(cycle.cycle_week_start);
  const we = parseDDMMYYYY(cycle.cycle_week_end);
  const due = parseDDMMYYYY(cycle.cycle_due_date);
  const origDue = parseDDMMYYYY(cycle.original_due_date);
  const currentDue = parseDDMMYYYY(cycle.current_due_date);
  const completed = cycle.completed_at ? moment(cycle.completed_at).startOf('day') : null;

  const inRange = (d) => d && d.isSameOrAfter(rangeStart) && d.isSameOrBefore(rangeEnd);

  // 1. Cycle week overlaps selected range
  if (ws && we && ws.isSameOrBefore(rangeEnd) && we.isSameOrAfter(rangeStart)) return true;
  // 2. Due date in range
  if (inRange(due)) return true;
  // 3. Original or current due date in range
  if (inRange(origDue)) return true;
  if (inRange(currentDue)) return true;
  // 4. Completion date in range
  if (inRange(completed)) return true;
  // 5. Still pending and overdue during range
  if (cycle.cycle_status === 'active' && cycle.unmanaged_overdue_days > 0 && due && due.isSameOrBefore(rangeEnd)) return true;

  return false;
}

// ─── Person-wise aggregation ──────────────────────────────────────────────────

/**
 * Aggregate scoring cycles into person-level summaries.
 * @param {Object[]} cycles – all cycles (already filtered by date range)
 * @returns {Object[]} sorted array of person summaries (worst first)
 */
export function aggregateByPerson(cycles) {
  const map = {};

  for (const c of cycles) {
    const key = c.assigned_to_email;
    if (!map[key]) {
      map[key] = {
        person_email: key,
        person_name: c.assigned_to_name,
        total: 0,
        green: 0,
        yellow: 0,
        red: 0,
        date_change_requested: 0,
        week_shifted: 0,
        unmanaged_overdue: 0,
        cycles: [],
      };
    }
    const p = map[key];
    p.total += 1;
    if (c.task_health === 'Green') p.green += 1;
    else if (c.task_health === 'Yellow') p.yellow += 1;
    else p.red += 1;
    if (c.date_change_count > 0) p.date_change_requested += 1;
    if (c.week_shifted) p.week_shifted += 1;
    if (c.unmanaged_overdue_days > 0) p.unmanaged_overdue += 1;
    p.cycles.push(c);
  }

  const result = Object.values(map).map(p => {
    const pct = (n) => p.total > 0 ? Math.round((n / p.total) * 100) : 0;
    const redPct = pct(p.red);
    const yellowPct = pct(p.yellow);
    const greenPct = pct(p.green);

    let person_health = 'Good';
    if (redPct > 30) person_health = 'Critical';
    else if (yellowPct > 30) person_health = 'Needs Follow-up';

    return { ...p, green_pct: greenPct, yellow_pct: yellowPct, red_pct: redPct, person_health };
  });

  // Sort: worst first — highest Red%, then Yellow%, then total
  result.sort((a, b) => {
    if (b.red_pct !== a.red_pct) return b.red_pct - a.red_pct;
    if (b.yellow_pct !== a.yellow_pct) return b.yellow_pct - a.yellow_pct;
    return b.total - a.total;
  });

  return result;
}

// ─── Aggregate KPIs ───────────────────────────────────────────────────────────

/**
 * Compute top-level KPI totals from all filtered cycles.
 */
export function computeKPIs(cycles) {
  const total = cycles.length;
  let green = 0, yellow = 0, red = 0, dateChangeReq = 0, weekShifted = 0, unmanagedOverdue = 0;

  for (const c of cycles) {
    if (c.task_health === 'Green') green++;
    else if (c.task_health === 'Yellow') yellow++;
    else red++;
    if (c.date_change_count > 0) dateChangeReq++;
    if (c.week_shifted) weekShifted++;
    if (c.unmanaged_overdue_days > 0) unmanagedOverdue++;
  }

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  return {
    total,
    green, yellow, red,
    green_pct: pct(green), yellow_pct: pct(yellow), red_pct: pct(red),
    date_change_requested: dateChangeReq,
    week_shifted: weekShifted,
    unmanaged_overdue: unmanagedOverdue,
  };
}

// ─── Week helpers for filters ─────────────────────────────────────────────────

export function getCurrentWeekRange() {
  const start = moment().startOf('isoWeek');
  const end = moment().endOf('isoWeek');
  return { start, end, label: `${start.format('DD/MM/YYYY')} – ${end.format('DD/MM/YYYY')}` };
}

export function getWeekRangeOffset(offset) {
  const start = moment().startOf('isoWeek').add(offset, 'weeks');
  const end = start.clone().endOf('isoWeek');
  return { start, end, label: `${start.format('DD/MM/YYYY')} – ${end.format('DD/MM/YYYY')}` };
}