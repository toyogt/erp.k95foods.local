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

// Detects placeholder dates the device sometimes sends ("YYYY-05-DD ...")
function hasInvalidPlaceholders(s) {
  if (!s) return true;
  return /[A-Za-z]/.test(String(s)); // any letter means placeholder (Y, M, D, etc.)
}

function parseIoTime(io) {
  if (!io) return null;
  const raw = String(io).trim();
  if (hasInvalidPlaceholders(raw)) return null;
  const s = raw.replace(/\D/g, '');
  if (s.length < 14) return null;
  const yyyy = s.slice(0, 4);
  const MM = s.slice(4, 6);
  const dd = s.slice(6, 8);
  const HH = s.slice(8, 10);
  const mm = s.slice(10, 12);
  const ss = s.slice(12, 14);
  // Sanity check: year between 2000 and 2100
  const yr = Number(yyyy);
  if (yr < 2000 || yr > 2100) return null;
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

// Parses "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss" as IST local time.
// Returns null if unparseable or contains letter-placeholders.
function parseLogDateTime(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (hasInvalidPlaceholders(raw)) return null;
  // Convert "YYYY-MM-DD HH:mm:ss" → io_time digits
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, yyyy, MM, dd, HH, mm, ss] = match;
  return parseIoTime(`${yyyy}${MM}${dd}${HH}${mm}${ss}`);
}

// Convert IST ISO (with +05:30) into io_time-style "YYYYMMDDHHmmss" using IST clock
function istIsoToDigits(istIso) {
  const m = String(istIso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`;
}

// Returns today's date in IST as { yyyy, MM, dd }
function istTodayParts() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return {
    yyyy: String(ist.getUTCFullYear()),
    MM: pad2(ist.getUTCMonth() + 1),
    dd: pad2(ist.getUTCDate()),
  };
}

// Try to extract just HH:mm:ss from a string (even if date is placeholder)
function extractTimeOnly(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return { HH: m[1], mm: m[2], ss: m[3] };
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

async function processPunch(base44, { rawPunchId, userId, ioTime, devId, rawHeaders, employeeNameFromBody }) {
  const parsed = parseIoTime(ioTime);
  if (!userId || !parsed) {
    if (rawPunchId) {
      try {
        await base44.asServiceRole.entities.AttendanceRawPunch.update(rawPunchId, {
          process_error: !userId
            ? 'missing_employee_code'
            : 'invalid_or_placeholder_datetime',
          processed: true,
        });
      } catch { /* ignore */ }
    }
    return;
  }

  const normCode = normalizeEmployeeCode(userId);

  // Enrich from Employee master (best-effort)
  let canonicalCode = String(userId).trim();
  let employeeName = employeeNameFromBody ? String(employeeNameFromBody).trim() : '';
  try {
    const matches = await base44.asServiceRole.entities.Employee.list('-created_date', 5000);
    for (const emp of matches) {
      if (normalizeEmployeeCode(emp.employee_code) === normCode) {
        canonicalCode = emp.employee_code;
        if (emp.employee_name) employeeName = emp.employee_name;
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

  // Accept BOTH formats:
  //  (a) realtime_glog: { user_id, io_time, dev_id }
  //  (b) JSON push format: { employee_code, log_datetime, device_sn, downloaded_at, employee_name, ... }
  const userId = body.user_id ?? body.UserId ?? body.userid ?? body.user
    ?? body.employee_code ?? body.EmpCode ?? body.empCode ?? '';

  let ioTime = body.io_time ?? body.ioTime ?? body.IoTime ?? body.time ?? '';
  // If io_time not present, derive from log_datetime (e.g. "YYYY-MM-DD HH:mm:ss")
  if (!ioTime) {
    const parsedLog = parseLogDateTime(body.log_datetime ?? body.LogDateTime ?? body.logDateTime ?? '');
    if (parsedLog) {
      ioTime = istIsoToDigits(parsedLog.iso);
    }
  }
  // Fallback: if log_datetime is a placeholder ("YYYY-05-DD..."), try downloaded_at
  if (!ioTime) {
    const parsedDownload = parseLogDateTime(body.downloaded_at ?? body.DownloadDateTime ?? body.download_datetime ?? '');
    if (parsedDownload) {
      ioTime = istIsoToDigits(parsedDownload.iso);
    }
  }
  // Final fallback: device sent placeholder dates everywhere ("YYYY-05-DD").
  // Use today's IST date + the HH:mm:ss extracted from log_time (or log_datetime).
  if (!ioTime) {
    const timeOnly = extractTimeOnly(body.log_time)
      || extractTimeOnly(body.log_datetime)
      || extractTimeOnly(body.downloaded_at);
    if (timeOnly) {
      const { yyyy, MM, dd } = istTodayParts();
      ioTime = `${yyyy}${MM}${dd}${timeOnly.HH}${timeOnly.mm}${timeOnly.ss}`;
    }
  }

  const devId = body.dev_id ?? body.devId ?? body.device_sn ?? body.DevId ?? body.DeviceSN ?? '';
  const employeeNameFromBody = body.employee_name ?? body.EmpName ?? body.empName ?? body.UserName ?? '';

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
      employeeNameFromBody,
    });
  } catch (e) {
    // Even on internal error, ACK the device to prevent floods of retries.
    console.error('[ingestBiometricPunch] processing error:', e.message);
  }

  return ackResponse();
});