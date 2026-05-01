// Public webhook endpoint to receive realtime biometric machine posts
// (request_code: realtime_glog format).
//
// Behavior:
//  - Validates request_code header (expected: realtime_glog).
//  - Parses body — supports JSON, key=value, and url-encoded forms.
//  - Extracts user_id, io_time (YYYYMMDDhhmmss), dev_id.
//  - ALWAYS responds to the machine with HTTP 200 and body "response_code=OK"
//    plus header response_code: OK, even for malformed posts (machines
//    re-send aggressively if they don't see the ACK).
//  - Asynchronously: writes AttendanceRawPunch, decodes punch, dedup-checks,
//    enriches from Employee master, creates AttendanceLog and AttendanceOutbox.
//
// No Base44 user auth required (machine-to-machine).
// Optional shared-secret header `x-ingest-token` validated against
// LBL_DPT_PC_01_TKN if that secret is set (legacy compatibility).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACK_HEADERS = { 'Content-Type': 'text/plain', 'response_code': 'OK' };
const ACK_BODY = 'response_code=OK';

function pad2(n) { return String(n).padStart(2, '0'); }

// IST = UTC+05:30. We need server-local IST timestamps without UTC conversion.
function istNowIso() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return ist.toISOString().replace('Z', '+05:30');
}

function parseIoTime(io) {
  if (!io) return null;
  const s = String(io).replace(/\D/g, '');
  if (s.length < 14) return null;
  const yyyy = s.slice(0, 4);
  const MM = s.slice(4, 6);
  const dd = s.slice(6, 8);
  const HH = s.slice(8, 10);
  const mm = s.slice(10, 12);
  const ss = s.slice(12, 14);
  // Treat punch as IST local time (no UTC conversion).
  const iso = `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}+05:30`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    iso,
    log_date: `${dd}/${MM}/${yyyy}`,
    log_time: `${HH}:${mm}:${ss}`,
  };
}

function parseBody(rawText) {
  if (!rawText) return {};
  const t = rawText.trim();
  // JSON
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  // url-encoded or key=value&key=value
  if (t.includes('=')) {
    const out = {};
    for (const pair of t.split(/[&\n]/)) {
      const [k, ...rest] = pair.split('=');
      if (!k) continue;
      out[k.trim()] = decodeURIComponent((rest.join('=') || '').trim());
    }
    return out;
  }
  return { _raw: t };
}

function normalizeEmployeeCode(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim().toUpperCase();
  if (!s) return '';
  const m = s.match(/^([A-Z]*)(\d+)$/);
  if (m) return `${m[1]}${m[2].replace(/^0+/, '') || '0'}`;
  return s;
}

function ackResponse() {
  return new Response(ACK_BODY, { status: 200, headers: ACK_HEADERS });
}

async function processPunch(base44, { rawPunchId, userId, ioTime, devId, rawHeaders }) {
  const parsed = parseIoTime(ioTime);
  if (!userId || !parsed) {
    if (rawPunchId) {
      try {
        await base44.asServiceRole.entities.AttendanceRawPunch.update(rawPunchId, {
          process_error: 'missing_user_id_or_io_time',
          processed: true,
        });
      } catch { /* ignore */ }
    }
    return;
  }

  const normCode = normalizeEmployeeCode(userId);

  // Enrich from Employee master (best-effort)
  let canonicalCode = String(userId).trim();
  let employeeName = '';
  try {
    const matches = await base44.asServiceRole.entities.Employee.list('-created_date', 5000);
    for (const emp of matches) {
      if (normalizeEmployeeCode(emp.employee_code) === normCode) {
        canonicalCode = emp.employee_code;
        employeeName = emp.employee_name || '';
        break;
      }
    }
  } catch (e) {
    console.warn('Employee enrichment failed:', e.message);
  }

  const dedupKey = `${canonicalCode}|${parsed.iso}|${devId || ''}`;

  // Dedup: skip if AttendanceLog with same dedup_key exists
  try {
    const existing = await base44.asServiceRole.entities.AttendanceLog.filter({ dedup_key: dedupKey }, '-created_date', 1);
    if (existing && existing.length > 0) {
      if (rawPunchId) {
        await base44.asServiceRole.entities.AttendanceRawPunch.update(rawPunchId, {
          processed: true,
          process_error: 'duplicate_skipped',
        });
      }
      console.log(`[ingestBiometricPunch] duplicate skipped key=${dedupKey}`);
      return;
    }
  } catch (e) {
    console.warn('Dedup check failed:', e.message);
  }

  const downloadedAt = istNowIso();
  const logData = {
    employee_code: canonicalCode,
    employee_name: employeeName,
    log_datetime: parsed.iso,
    log_date: parsed.log_date,
    log_time: parsed.log_time,
    downloaded_at: downloadedAt,
    device_sn: devId ? String(devId).trim() : '',
    device_no: '',
    device_name: '',
    punch_direction: '',
    dedup_key: dedupKey,
    raw_punch_id: rawPunchId || '',
    delivery_status: 'PENDING',
    raw_payload: { user_id: userId, io_time: ioTime, dev_id: devId, headers: rawHeaders },
  };

  let attendanceLog;
  try {
    attendanceLog = await base44.asServiceRole.entities.AttendanceLog.create(logData);
  } catch (e) {
    console.error('AttendanceLog create failed:', e.message);
    if (rawPunchId) {
      await base44.asServiceRole.entities.AttendanceRawPunch.update(rawPunchId, {
        processed: true,
        process_error: `attendance_log_create_failed: ${e.message}`,
      });
    }
    return;
  }

  // Build outbound payload
  const outboundPayload = {
    employee_code: canonicalCode,
    employee_name: employeeName,
    log_datetime: parsed.iso,
    log_date: parsed.log_date,
    log_time: parsed.log_time,
    downloaded_at: downloadedAt,
    device_sn: logData.device_sn,
    device_name: '',
    device_no: '',
  };

  const targetUrl = Deno.env.get('ATTENDANCE_TARGET_URL')
    || 'https://app.base44.app/api/apps/69d9e3266866e06835189ca7/functions/captureAttendance';

  try {
    await base44.asServiceRole.entities.AttendanceOutbox.create({
      attendance_log_id: attendanceLog.id,
      dedup_key: dedupKey,
      target_url: targetUrl,
      payload: outboundPayload,
      status: 'PENDING',
      retry_count: 0,
      max_retries: 5,
      next_attempt_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('AttendanceOutbox create failed:', e.message);
    await base44.asServiceRole.entities.AttendanceLog.update(attendanceLog.id, {
      delivery_status: 'NOT_QUEUED',
    });
  }

  if (rawPunchId) {
    await base44.asServiceRole.entities.AttendanceRawPunch.update(rawPunchId, { processed: true });
  }

  console.log(`[ingestBiometricPunch] queued employee=${canonicalCode} time=${parsed.iso} device=${devId}`);
}

Deno.serve(async (req) => {
  // Health check
  if (req.method === 'GET') {
    return Response.json({ ok: true, service: 'ingestBiometricPunch', time: istNowIso() });
  }
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 });
  }

  // Capture all headers (lowercased) for audit
  const rawHeaders = {};
  for (const [k, v] of req.headers.entries()) rawHeaders[k.toLowerCase()] = v;
  const requestCode = rawHeaders['request_code'] || rawHeaders['x-request-code'] || '';

  // Optional shared-secret check (legacy LBL_DPT_PC_01_TKN reused if device sends it)
  const expectedToken = Deno.env.get('INGEST_TOKEN') || '';
  if (expectedToken) {
    const provided = rawHeaders['x-ingest-token'] || '';
    if (provided !== expectedToken) {
      // Still ACK to keep the machine happy, but skip processing.
      console.warn('[ingestBiometricPunch] unauthorized post — token mismatch');
      return ackResponse();
    }
  }

  const rawText = await req.text();
  const body = parseBody(rawText);

  // Validate request_code
  if (requestCode && requestCode !== 'realtime_glog') {
    console.warn(`[ingestBiometricPunch] unexpected request_code=${requestCode}`);
  }

  const userId = body.user_id ?? body.UserId ?? body.userid ?? body.user ?? '';
  const ioTime = body.io_time ?? body.ioTime ?? body.IoTime ?? body.time ?? '';
  const devId = body.dev_id ?? body.devId ?? body.device_sn ?? body.DevId ?? '';

  // Persist raw punch first — never lose data, even if downstream parsing fails.
  let rawPunchId = '';
  try {
    const base44 = createClientFromRequest(req);
    const rp = await base44.asServiceRole.entities.AttendanceRawPunch.create({
      request_code: requestCode || '',
      user_id: String(userId || ''),
      io_time: String(ioTime || ''),
      dev_id: String(devId || ''),
      raw_body: rawText.slice(0, 8000),
      raw_headers: rawHeaders,
      received_at: istNowIso(),
      processed: false,
    });
    rawPunchId = rp.id;

    // Process synchronously — keeps things simple and the machine
    // is happy as long as we ACK within a few seconds.
    await processPunch(base44, {
      rawPunchId,
      userId,
      ioTime,
      devId,
      rawHeaders,
    });
  } catch (e) {
    // Even on internal error, ACK the device to prevent floods of retries.
    console.error('[ingestBiometricPunch] processing error:', e.message);
  }

  return ackResponse();
});