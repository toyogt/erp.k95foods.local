// Outbox worker: delivers pending AttendanceOutbox rows to the configured
// captureAttendance endpoint. Designed to be invoked on a schedule
// (every 5 minutes) and also on-demand from the admin dashboard.
//
// Reliability:
//  - Marks rows PROCESSING before attempting delivery
//  - Recovers stale PROCESSING rows (>10 minutes) automatically
//  - Exponential backoff with jitter via next_attempt_at
//  - Up to max_retries (default 5), then FAILED with reason
//  - Updates AttendanceLog.delivery_status to mirror outbox status
//
// Security:
//  - Outbound is HTTPS POST only
//  - ATTENDANCE_API_KEY read from secret; never logged

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10 min
const BATCH_SIZE = 50;

function backoffMs(retryCount) {
  // 30s, 60s, 2m, 4m, 8m + jitter 0-15s
  const base = Math.min(30 * 1000 * Math.pow(2, retryCount), 8 * 60 * 1000);
  const jitter = Math.floor(Math.random() * 15 * 1000);
  return base + jitter;
}

async function deliver(row) {
  const apiKey = Deno.env.get('ATTENDANCE_API_KEY') || '';
  if (!apiKey) {
    return { ok: false, status: 0, body: 'ATTENDANCE_API_KEY not configured', terminal: true };
  }
  if (!row.target_url || !row.target_url.startsWith('https://')) {
    return { ok: false, status: 0, body: 'target_url must be HTTPS', terminal: true };
  }

  try {
    const res = await fetch(row.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ATTENDANCE_API_KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(row.payload),
    });
    const text = await res.text();
    const ok = res.status >= 200 && res.status < 300;
    return { ok, status: res.status, body: text.slice(0, 1500), terminal: false };
  } catch (e) {
    return { ok: false, status: 0, body: `network_error: ${e.message}`, terminal: false };
  }
}

Deno.serve(async (req) => {
  // Allow scheduled invoke (no auth) AND admin manual invoke.
  // For manual admin calls we verify role; scheduled calls have no user.
  const base44 = createClientFromRequest(req);

  let user = null;
  try { user = await base44.auth.me(); } catch { /* scheduled */ }
  if (user && user.role !== 'admin') {
    return Response.json({ ok: false, error: 'admin_required' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const summary = { picked: 0, sent: 0, retried: 0, failed: 0, recovered_stale: 0 };

  // 1) Recover stale PROCESSING rows
  try {
    const stuck = await base44.asServiceRole.entities.AttendanceOutbox.filter({ status: 'PROCESSING' }, '-last_attempt_at', 200);
    for (const row of stuck) {
      const last = row.last_attempt_at ? new Date(row.last_attempt_at).getTime() : 0;
      if (Date.now() - last > STALE_PROCESSING_MS) {
        await base44.asServiceRole.entities.AttendanceOutbox.update(row.id, { status: 'PENDING' });
        summary.recovered_stale += 1;
      }
    }
  } catch (e) {
    console.warn('stale_recovery_failed:', e.message);
  }

  // 2) Pick PENDING rows whose next_attempt_at <= now
  let pending = [];
  try {
    pending = await base44.asServiceRole.entities.AttendanceOutbox.filter({ status: 'PENDING' }, 'next_attempt_at', BATCH_SIZE);
  } catch (e) {
    return Response.json({ ok: false, error: `query_failed: ${e.message}` }, { status: 500 });
  }

  for (const row of pending) {
    if (row.next_attempt_at && row.next_attempt_at > nowIso) continue;
    summary.picked += 1;

    // Lock row
    try {
      await base44.asServiceRole.entities.AttendanceOutbox.update(row.id, {
        status: 'PROCESSING',
        last_attempt_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('lock_failed:', e.message);
      continue;
    }

    const result = await deliver(row);

    if (result.ok) {
      try {
        await base44.asServiceRole.entities.AttendanceOutbox.update(row.id, {
          status: 'SENT',
          sent_at: new Date().toISOString(),
          response_status_code: result.status,
          response_body_excerpt: result.body,
          failure_reason: '',
        });
        if (row.attendance_log_id) {
          await base44.asServiceRole.entities.AttendanceLog.update(row.attendance_log_id, { delivery_status: 'SENT' });
        }
        summary.sent += 1;
      } catch (e) {
        console.warn('mark_sent_failed:', e.message);
      }
      continue;
    }

    // Failure path
    const newRetry = (row.retry_count || 0) + 1;
    const max = row.max_retries || 5;
    const isTerminal = result.terminal || newRetry >= max;

    try {
      if (isTerminal) {
        await base44.asServiceRole.entities.AttendanceOutbox.update(row.id, {
          status: 'FAILED',
          retry_count: newRetry,
          response_status_code: result.status,
          response_body_excerpt: result.body,
          failure_reason: `max_retries_reached: ${result.body}`.slice(0, 1900),
        });
        if (row.attendance_log_id) {
          await base44.asServiceRole.entities.AttendanceLog.update(row.attendance_log_id, { delivery_status: 'FAILED' });
        }
        summary.failed += 1;
      } else {
        const next = new Date(Date.now() + backoffMs(newRetry)).toISOString();
        await base44.asServiceRole.entities.AttendanceOutbox.update(row.id, {
          status: 'PENDING',
          retry_count: newRetry,
          next_attempt_at: next,
          response_status_code: result.status,
          response_body_excerpt: result.body,
          failure_reason: result.body.slice(0, 1900),
        });
        summary.retried += 1;
      }
    } catch (e) {
      console.warn('mark_failed_update_failed:', e.message);
    }
  }

  return Response.json({ ok: true, summary, at: nowIso });
});