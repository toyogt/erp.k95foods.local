/**
 * syncHRAttritionToSheets
 * ─────────────────────────────────────────────────────────────────────
 * Pushes CandidateLead records to Google Sheets via the existing
 * GOOGLE_SHEETS_WEBHOOK_URL (Apps Script web app). The Apps Script is
 * expected to upsert each row by `id` into the sheet specified in meta.sheet_name.
 *
 * Modes:
 *   - manual      : called from the BI Export panel, syncs all candidates
 *   - incremental : called by scheduled automation, syncs only updated since last run
 *
 * Output: BI tools (Tableau / Power BI / Looker Studio) can connect directly
 * to the Google Sheet for live dashboards.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const WEBHOOK_URL = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL');
const SHEET_NAME = 'HR_Attrition';
const ALLOWED_ROLES = ['admin', 'hr_manager'];

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return '';
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b)) return '';
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function buildRow(c) {
  return {
    name: c.id || '',
    id: c.id || '',
    candidate_name: c.candidate_name || '',
    mobile_number: c.mobile_number || '',
    location_area: c.location_area || '',
    role_interested: c.role_interested || '',
    source_type: c.source_type || '',
    source_details: c.source_details || '',
    first_contact_mode: c.first_contact_mode || '',
    first_contact_date: c.first_contact_date || '',
    status: c.status || '',
    employee_code: c.employee_code || '',
    department: c.department || '',
    designation: c.designation || '',
    enrollment_date: c.enrollment_date || '',
    attrition_date: c.attrition_date || '',
    last_working_day: c.last_working_day || '',
    exit_type: c.exit_type || '',
    attrition_reason: c.attrition_reason || '',
    eligible_for_rehire: c.eligible_for_rehire ? 'Yes' : '',
    days_employed: c.days_employed ?? daysBetween(c.enrollment_date, c.attrition_date),
    tenure_days_computed: daysBetween(c.enrollment_date, c.attrition_date),
    is_active: c.is_active === false ? 'No' : 'Yes',
    created_date: c.created_date || '',
    updated_date: c.updated_date || '',
    synced_at: new Date().toISOString(),
  };
}

async function pushBatch(rows) {
  // Apps Script may receive single-row payloads only — push sequentially with
  // small concurrency to avoid overrunning the Apps Script free-tier limits.
  const results = { succeeded: 0, failed: 0, errors: [] };
  for (const row of rows) {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta: { doctype: 'CandidateLead', sheet_name: SHEET_NAME },
          data: row,
        }),
      });
      if (res.ok) {
        results.succeeded += 1;
      } else {
        results.failed += 1;
        results.errors.push(`HTTP ${res.status} for ${row.id}`);
      }
    } catch (err) {
      results.failed += 1;
      results.errors.push(`${row.id}: ${err.message}`);
    }
  }
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow service-role invocation (scheduled automation) — has no req user
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    // For manual user calls: enforce role; scheduled invocations are trusted
    const isScheduledOrAuthorized =
      !user || (user && ALLOWED_ROLES.includes(user.role));

    if (user && !ALLOWED_ROLES.includes(user.role)) {
      return Response.json(
        { error: 'Forbidden: Admin or HR Manager access required' },
        { status: 403 }
      );
    }

    if (!isScheduledOrAuthorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!WEBHOOK_URL) {
      return Response.json(
        {
          error:
            'GOOGLE_SHEETS_WEBHOOK_URL secret not configured. Set it in Dashboard → Settings → Environment Variables.',
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode || 'manual'; // 'manual' | 'incremental'
    const sinceMinutes = Number(body?.since_minutes) || 60;

    // Fetch candidates to sync
    let candidates;
    if (mode === 'incremental') {
      const sinceISO = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
      const all = await base44.asServiceRole.entities.CandidateLead.list('-updated_date', 5000);
      candidates = all.filter((c) => (c.updated_date || c.created_date || '') >= sinceISO);
    } else {
      candidates = await base44.asServiceRole.entities.CandidateLead.list('-created_date', 5000);
    }

    console.info(`[syncHRAttritionToSheets] mode=${mode} count=${candidates.length}`);

    if (!candidates.length) {
      return Response.json({
        success: true,
        mode,
        synced: 0,
        message: 'No candidate records to sync.',
      });
    }

    const rows = candidates.map(buildRow);
    const results = await pushBatch(rows);

    return Response.json({
      success: results.failed === 0,
      mode,
      total: rows.length,
      succeeded: results.succeeded,
      failed: results.failed,
      sheet: SHEET_NAME,
      errors: results.errors.slice(0, 10),
    });
  } catch (error) {
    console.error('[syncHRAttritionToSheets] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});