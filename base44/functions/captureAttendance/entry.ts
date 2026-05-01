// Public webhook endpoint to receive attendance punches from biometric machines.
// Authentication: Bearer token in Authorization header, validated against ATTENDANCE_API_KEY secret.
// No user authentication required (machine-to-machine call).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const pad2 = (n) => String(n).padStart(2, '0');

function parseDateTime(input) {
  if (!input) return null;
  const normalized = typeof input === 'string' && input.includes(' ') && !input.includes('T')
    ? input.replace(' ', 'T')
    : input;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  const log_date = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const log_time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return { iso: d.toISOString(), log_date, log_time };
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}

function normalizeRecord(rec) {
  const employee_code = pick(rec, ['employee_code', 'EmpCode', 'emp_code', 'empCode', 'UserId', 'userid']);
  const employee_name = pick(rec, ['employee_name', 'EmpName', 'emp_name', 'empName', 'UserName']);
  const dt_raw = pick(rec, ['log_datetime', 'LogDateTime', 'logDateTime', 'punch_time', 'PunchTime', 'datetime', 'DateTime']);
  const downloaded_raw = pick(rec, ['downloaded_at', 'DownloadDateTime', 'download_datetime', 'downloadedAt']);
  const device_sn = pick(rec, ['device_sn', 'DeviceSN', 'device_serial', 'SerialNumber', 'serial_no']);
  const device_no = pick(rec, ['device_no', 'DeviceNo', 'deviceNo', 'device_number']);
  const device_name = pick(rec, ['device_name', 'DeviceName', 'deviceName']);
  const punch_direction = pick(rec, ['punch_direction', 'Direction', 'InOut', 'inout', 'punch_type']);

  const parsed = parseDateTime(dt_raw);
  if (!employee_code || !parsed) {
    return { ok: false, reason: 'missing_employee_code_or_datetime', raw: rec };
  }

  const downloadedParsed = parseDateTime(downloaded_raw);

  return {
    ok: true,
    record: {
      employee_code: String(employee_code).trim(),
      employee_name: employee_name ? String(employee_name).trim() : '',
      log_datetime: parsed.iso,
      log_date: parsed.log_date,
      log_time: parsed.log_time,
      downloaded_at: downloadedParsed ? downloadedParsed.iso : '',
      device_sn: device_sn ? String(device_sn).trim() : '',
      device_no: device_no ? String(device_no).trim() : '',
      device_name: device_name ? String(device_name).trim() : '',
      punch_direction: punch_direction ? String(punch_direction).trim() : '',
      raw_payload: rec,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed. Use POST.' }, { status: 405 });
  }

  const expectedKey = Deno.env.get('ATTENDANCE_API_KEY');
  if (!expectedKey) {
    return Response.json({ ok: false, error: 'Server misconfigured: ATTENDANCE_API_KEY not set' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!provided || provided !== expectedKey) {
    return Response.json({ ok: false, error: 'Unauthorized: invalid or missing API key' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (_e) {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawList = Array.isArray(body)
    ? body
    : Array.isArray(body?.data) ? body.data
    : Array.isArray(body?.records) ? body.records
    : Array.isArray(body?.logs) ? body.logs
    : [body];

  const accepted = [];
  const rejected = [];
  for (const rec of rawList) {
    const result = normalizeRecord(rec || {});
    if (result.ok) accepted.push(result.record);
    else rejected.push(result);
  }

  if (accepted.length === 0) {
    return Response.json({
      ok: false,
      error: 'No valid records found in payload',
      received: rawList.length,
      rejected,
    }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  let created = [];
  try {
    if (accepted.length === 1) {
      const row = await base44.asServiceRole.entities.AttendanceLog.create(accepted[0]);
      created = [row];
    } else {
      created = await base44.asServiceRole.entities.AttendanceLog.bulkCreate(accepted);
    }
  } catch (e) {
    return Response.json({ ok: false, error: `Database write failed: ${e.message}` }, { status: 500 });
  }

  return Response.json({
    ok: true,
    message: 'Attendance logs received',
    received: rawList.length,
    accepted: accepted.length,
    rejected: rejected.length,
    rejected_details: rejected,
    created_ids: Array.isArray(created) ? created.map((c) => c.id).filter(Boolean) : [],
  }, { status: 200 });
});