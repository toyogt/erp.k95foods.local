// Triggered automatically when DailyAttendanceSummary is created or updated.
// If the summary indicates an attendance anomaly (single punch, missing IN/OUT, etc.),
// emails the employee's supervisor / department head and CC's HR.
//
// Avoids duplicate alerts: if an alert with the same (employee_code, work_date_iso, alert_type)
// already exists, the function exits silently.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALERT_TYPE_BY_STATUS = {
  MISSING_OUT: 'MISSING_OUT',
  MISSING_IN: 'MISSING_IN',
  FLAGGED: 'FLAGGED',
  NO_PUNCHES: 'NO_PUNCHES',
};

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Calcutta',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

function buildEmailBody({ summary, employee, alertType }) {
  const lines = [
    `Hello,`,
    ``,
    `An attendance anomaly was detected for the following employee:`,
    ``,
    `• Name:  ${employee?.employee_name || summary.employee_name || summary.employee_code}`,
    `• Code:  ${summary.employee_code}`,
    `• Department:  ${employee?.department || '—'}`,
    `• Designation: ${employee?.designation || '—'}`,
    `• Date:  ${summary.work_date}`,
    `• Status: ${summary.status} (${alertType})`,
    `• Punches recorded: ${summary.punch_count || 0}`,
    `• First IN:  ${fmt(summary.first_in)}`,
    `• Last OUT:  ${fmt(summary.last_out)}`,
    ``,
    `Please follow up with the employee and, if needed, raise a Manual Punch Request in K95 ERP > HR > Punch Requests.`,
    ``,
    `— K95 ERP HR System`,
  ];
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Use POST' }, { status: 405 });
  }

  let payload = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const summary = payload.data;
  const oldData = payload.old_data || null;
  if (!summary || !summary.employee_code) {
    return Response.json({ ok: true, skipped: 'no summary data' });
  }

  const status = summary.status;
  const alertType = ALERT_TYPE_BY_STATUS[status];
  if (!alertType) {
    return Response.json({ ok: true, skipped: `status ${status} is not an anomaly` });
  }

  // For updates, only send if status actually became an anomaly (or the day changed).
  // This avoids re-sending when HR just adds a remark.
  if (oldData && oldData.status === status) {
    return Response.json({ ok: true, skipped: 'status unchanged' });
  }

  const base44 = createClientFromRequest(req);

  // Load HR config
  const cfgRows = await base44.asServiceRole.entities.HRNotificationConfig
    .filter({ config_key: 'DEFAULT' }, '-updated_date', 1)
    .catch(() => []);
  const cfg = cfgRows[0];
  if (cfg && cfg.is_active === false) {
    return Response.json({ ok: true, skipped: 'HR notifications disabled' });
  }

  // Per-type toggle
  if (cfg) {
    if (alertType === 'MISSING_OUT' && cfg.alert_on_missing_out === false) {
      return Response.json({ ok: true, skipped: 'MISSING_OUT alerts disabled' });
    }
    if (alertType === 'MISSING_IN' && cfg.alert_on_missing_in === false) {
      return Response.json({ ok: true, skipped: 'MISSING_IN alerts disabled' });
    }
    if (alertType === 'FLAGGED' && cfg.alert_on_flagged !== true) {
      return Response.json({ ok: true, skipped: 'FLAGGED alerts disabled' });
    }
    if (alertType === 'NO_PUNCHES' && cfg.alert_on_no_punches !== true) {
      return Response.json({ ok: true, skipped: 'NO_PUNCHES alerts disabled' });
    }
  }

  // Skip holidays
  if (summary.is_holiday && (cfg?.skip_holidays !== false)) {
    return Response.json({ ok: true, skipped: 'holiday' });
  }

  // Dedup: if we already alerted for this employee+date+alertType, skip
  const existing = await base44.asServiceRole.entities.AttendanceAlertLog
    .filter({
      employee_code: summary.employee_code,
      work_date_iso: summary.work_date_iso,
      alert_type: alertType,
    }, '-sent_at', 1)
    .catch(() => []);
  if (existing.length > 0) {
    return Response.json({ ok: true, skipped: 'already alerted' });
  }

  // Resolve employee + supervisor
  const empRows = await base44.asServiceRole.entities.Employee
    .filter({ employee_code: summary.employee_code }, '-created_date', 1)
    .catch(() => []);
  const employee = empRows[0] || null;

  // Skip weekly off
  if (
    cfg?.skip_weekly_off !== false &&
    employee?.weekly_off &&
    summary.work_date_iso
  ) {
    const wo = String(employee.weekly_off).trim().toLowerCase();
    const dow = new Date(summary.work_date_iso + 'T00:00:00Z')
      .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Calcutta' })
      .toLowerCase();
    if (wo && wo !== 'none' && wo === dow) {
      return Response.json({ ok: true, skipped: 'weekly off' });
    }
  }

  // Resolve department head email
  let deptHeadEmail = '';
  if (employee?.department) {
    const deptRows = await base44.asServiceRole.entities.Department
      .filter({ department_name: employee.department }, '-updated_date', 1)
      .catch(() => []);
    deptHeadEmail = deptRows[0]?.department_head_email || '';
  }

  const supervisorEmail = (employee?.supervisor_email || '').trim();
  const hrEmails = (cfg?.hr_emails || []).filter(Boolean);

  // Primary recipient: supervisor_email else department head
  const toList = [];
  if (supervisorEmail) toList.push(supervisorEmail);
  else if (deptHeadEmail) toList.push(deptHeadEmail);

  // CC: HR (and dept head if supervisor was used)
  const ccList = [];
  if (supervisorEmail && deptHeadEmail && deptHeadEmail !== supervisorEmail) ccList.push(deptHeadEmail);
  for (const e of hrEmails) {
    if (!toList.includes(e) && !ccList.includes(e)) ccList.push(e);
  }

  const recipients = [...toList, ...ccList];

  const alertRecord = {
    employee_code: summary.employee_code,
    employee_name: employee?.employee_name || summary.employee_name || '',
    work_date: summary.work_date,
    work_date_iso: summary.work_date_iso,
    alert_type: alertType,
    summary_status: summary.status,
    department: employee?.department || '',
    supervisor_email: supervisorEmail,
    department_head_email: deptHeadEmail,
    hr_emails: hrEmails,
    recipients_to: toList,
    recipients_cc: ccList,
    punch_count: summary.punch_count || 0,
    first_in: summary.first_in || null,
    last_out: summary.last_out || null,
    summary_id: payload?.event?.entity_id || '',
    sent_at: new Date().toISOString(),
  };

  if (recipients.length === 0) {
    alertRecord.send_status = 'SKIPPED_NO_RECIPIENT';
    alertRecord.failure_reason = 'No supervisor, department head, or HR email configured.';
    await base44.asServiceRole.entities.AttendanceAlertLog.create(alertRecord);
    return Response.json({ ok: true, skipped: 'no recipient', alert: alertRecord });
  }

  const subject = `[Attendance Alert] ${alertRecord.employee_name || summary.employee_code} — ${alertType.replace(/_/g, ' ')} on ${summary.work_date}`;
  const body = buildEmailBody({ summary, employee, alertType });

  // Send one email per recipient (Core.SendEmail does not natively support CC).
  const failures = [];
  for (const to of recipients) {
    try {
      await base44.integrations.Core.SendEmail({
        to,
        subject,
        body,
        from_name: 'K95 HR Alerts',
      });
    } catch (err) {
      failures.push(`${to}: ${err?.message || 'send failed'}`);
    }
  }

  if (failures.length === recipients.length) {
    alertRecord.send_status = 'FAILED';
    alertRecord.failure_reason = failures.join('; ').slice(0, 1000);
  } else {
    alertRecord.send_status = 'SENT';
    if (failures.length) alertRecord.failure_reason = failures.join('; ').slice(0, 1000);
  }

  await base44.asServiceRole.entities.AttendanceAlertLog.create(alertRecord);

  return Response.json({
    ok: true,
    alert_type: alertType,
    employee_code: summary.employee_code,
    work_date: summary.work_date,
    sent_to: toList,
    cc: ccList,
    failures,
  });
});