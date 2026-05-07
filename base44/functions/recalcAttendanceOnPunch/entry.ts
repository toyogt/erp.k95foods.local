// Auto-recalculates DailyAttendanceSummary when a new AttendanceLog is created.
// Triggered by entity automation on AttendanceLog.create.
// Calls calculateDailyAttendance for the affected (employee_code, work_date) so
// the summary stays in sync with the latest punches without waiting for the nightly job.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Convert DD/MM/YYYY → YYYY-MM-DD
function ddmmyyyyToIso(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const event = body?.event || {};
    const data = body?.data || {};

    if (event.type !== 'create' || event.entity_name !== 'AttendanceLog') {
      return Response.json({ ok: true, skipped: 'not a create on AttendanceLog' });
    }

    const logDate = data.log_date; // DD/MM/YYYY
    const workDateIso = ddmmyyyyToIso(logDate);
    if (!workDateIso) {
      return Response.json({ ok: false, error: 'Could not derive work_date_iso from log_date', log_date: logDate });
    }

    // Invoke calculateDailyAttendance for this single date
    const base44 = createClientFromRequest(req);
    const result = await base44.asServiceRole.functions.invoke('calculateDailyAttendance', {
      work_date_iso: workDateIso,
    });

    return Response.json({
      ok: true,
      employee_code: data.employee_code,
      work_date_iso: workDateIso,
      recalc_result: result?.data || result,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});