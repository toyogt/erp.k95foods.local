// Apply or reject a ManualPunchRequest. Only admin / hr_manager / hr_supervisor / supervisor may approve.
// On approval:
//   - add    → creates new AttendanceLog
//   - edit   → updates existing AttendanceLog
//   - delete → deletes existing AttendanceLog
// Then triggers recalculation of DailyAttendanceSummary for the affected day(s).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APPROVER_ROLES = new Set(['admin', 'hr_manager', 'hr_supervisor', 'supervisor']);

function pad2(n) { return String(n).padStart(2, '0'); }

function isoToWorkDateIso(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// IST date key
function istWorkDateIso(iso) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Calcutta',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date(iso)).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isoToDDMMYYYY(iso) {
  const d = new Date(iso);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function isoToTimeStr(iso) {
  const d = new Date(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Use POST' }, { status: 405 });
  }

  let user;
  try {
    const base44Auth = createClientFromRequest(req);
    user = await base44Auth.auth.me();
  } catch {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!user || !APPROVER_ROLES.has(user.role)) {
    return Response.json({ ok: false, error: 'Forbidden — approver role required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { request_id, action, review_remarks } = body;
  if (!request_id || !['approve', 'reject'].includes(action)) {
    return Response.json({ ok: false, error: 'request_id and action (approve|reject) required' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  // Load the request
  const reqDoc = await base44.asServiceRole.entities.ManualPunchRequest.get(request_id).catch(() => null);
  if (!reqDoc) {
    return Response.json({ ok: false, error: 'Request not found' }, { status: 404 });
  }
  if (reqDoc.status !== 'PENDING') {
    return Response.json({ ok: false, error: `Request already ${reqDoc.status.toLowerCase()}` }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // REJECT path
  if (action === 'reject') {
    await base44.asServiceRole.entities.ManualPunchRequest.update(request_id, {
      status: 'REJECTED',
      reviewed_by: user.email,
      reviewed_at: nowIso,
      review_remarks: review_remarks || '',
    });
    return Response.json({ ok: true, status: 'REJECTED' });
  }

  // APPROVE path
  let appliedLogId = null;
  let recalcDates = new Set();

  try {
    if (reqDoc.request_type === 'add') {
      const payload = {
        employee_code: reqDoc.employee_code,
        employee_name: reqDoc.employee_name || '',
        log_datetime: reqDoc.log_datetime,
        log_date: isoToDDMMYYYY(reqDoc.log_datetime),
        log_time: isoToTimeStr(reqDoc.log_datetime),
        punch_direction: reqDoc.punch_direction,
        device_sn: reqDoc.device_sn || 'MANUAL',
        dedup_key: `${reqDoc.employee_code}|${reqDoc.log_datetime}|${reqDoc.device_sn || 'MANUAL'}`,
        downloaded_at: nowIso,
        delivery_status: 'NOT_QUEUED',
        raw_payload: { source: 'manual_request', request_id, approved_by: user.email },
      };
      const created = await base44.asServiceRole.entities.AttendanceLog.create(payload);
      appliedLogId = created.id;
      recalcDates.add(istWorkDateIso(reqDoc.log_datetime));

    } else if (reqDoc.request_type === 'edit') {
      const existing = await base44.asServiceRole.entities.AttendanceLog.get(reqDoc.target_log_id).catch(() => null);
      if (!existing) throw new Error('Target attendance log no longer exists');
      // Capture old date for recalc
      recalcDates.add(istWorkDateIso(existing.log_datetime));
      const payload = {
        ...existing,
        employee_code: reqDoc.employee_code,
        log_datetime: reqDoc.log_datetime,
        log_date: isoToDDMMYYYY(reqDoc.log_datetime),
        log_time: isoToTimeStr(reqDoc.log_datetime),
        punch_direction: reqDoc.punch_direction,
        device_sn: reqDoc.device_sn || existing.device_sn || 'MANUAL',
        dedup_key: `${reqDoc.employee_code}|${reqDoc.log_datetime}|${reqDoc.device_sn || existing.device_sn || 'MANUAL'}`,
      };
      await base44.asServiceRole.entities.AttendanceLog.update(reqDoc.target_log_id, payload);
      appliedLogId = reqDoc.target_log_id;
      recalcDates.add(istWorkDateIso(reqDoc.log_datetime));

    } else if (reqDoc.request_type === 'delete') {
      const existing = await base44.asServiceRole.entities.AttendanceLog.get(reqDoc.target_log_id).catch(() => null);
      if (!existing) throw new Error('Target attendance log no longer exists');
      recalcDates.add(istWorkDateIso(existing.log_datetime));
      await base44.asServiceRole.entities.AttendanceLog.delete(reqDoc.target_log_id);
      appliedLogId = reqDoc.target_log_id;
    } else {
      throw new Error(`Unknown request_type: ${reqDoc.request_type}`);
    }
  } catch (e) {
    return Response.json({ ok: false, error: `Apply failed: ${e.message}` }, { status: 500 });
  }

  // Mark request approved
  await base44.asServiceRole.entities.ManualPunchRequest.update(request_id, {
    status: 'APPROVED',
    reviewed_by: user.email,
    reviewed_at: nowIso,
    review_remarks: review_remarks || '',
    applied_log_id: appliedLogId,
    recalc_triggered: true,
  });

  // Trigger recalculation for affected dates (best-effort; non-blocking semantics)
  const recalcResults = [];
  for (const dateIso of recalcDates) {
    try {
      const r = await base44.asServiceRole.functions.invoke('calculateDailyAttendance', { work_date_iso: dateIso });
      recalcResults.push({ date: dateIso, ok: true, summary: r?.data || r });
    } catch (e) {
      recalcResults.push({ date: dateIso, ok: false, error: e.message });
    }
  }

  return Response.json({
    ok: true,
    status: 'APPROVED',
    applied_log_id: appliedLogId,
    recalculation: recalcResults,
  });
});