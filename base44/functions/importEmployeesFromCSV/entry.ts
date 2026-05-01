// Import employees from a CSV file URL (e.g. TotalEmployee.csv).
// Admin-only. Idempotent: matches by normalized employee_code, updates if found,
// creates if new.
//
// Expected CSV columns (case-insensitive, flexible):
//   employee_code | EmpCode | code
//   employee_name | EmpName | name
//   email
//   phone
//   department
//   designation
//   date_of_joining (DD/MM/YYYY)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeEmployeeCode(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim().toUpperCase();
  if (!s) return '';
  const m = s.match(/^([A-Z]*)(\d+)$/);
  if (m) return `${m[1]}${m[2].replace(/^0+/, '') || '0'}`;
  return s;
}

function parseCsv(text) {
  // Minimal CSV parser supporting quoted fields with commas.
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

function pickColumn(headers, candidates) {
  const lower = headers.map(h => String(h || '').trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') {
    return Response.json({ ok: false, error: 'admin_required' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const { file_url } = body || {};
  if (!file_url) return Response.json({ ok: false, error: 'file_url required' }, { status: 400 });

  let csvText;
  try {
    const res = await fetch(file_url);
    if (!res.ok) return Response.json({ ok: false, error: `fetch_failed: ${res.status}` }, { status: 400 });
    csvText = await res.text();
  } catch (e) {
    return Response.json({ ok: false, error: `fetch_error: ${e.message}` }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) return Response.json({ ok: false, error: 'csv_empty_or_no_data_rows' }, { status: 400 });

  const headers = rows[0];
  const colCode = pickColumn(headers, ['employee_code', 'empcode', 'code', 'emp_code', 'userid', 'user_id']);
  const colName = pickColumn(headers, ['employee_name', 'empname', 'name', 'emp_name']);
  const colEmail = pickColumn(headers, ['email', 'email_id', 'emailid']);
  const colPhone = pickColumn(headers, ['phone', 'mobile', 'phone_no']);
  const colDept = pickColumn(headers, ['department', 'dept']);
  const colDesig = pickColumn(headers, ['designation', 'role', 'job_title']);
  const colDoj = pickColumn(headers, ['date_of_joining', 'doj', 'joining_date']);

  if (colCode < 0) {
    return Response.json({
      ok: false,
      error: 'employee_code column missing',
      headers_seen: headers,
    }, { status: 400 });
  }

  // Pre-load existing employees for fast normalized lookup
  let existing = [];
  try {
    existing = await base44.asServiceRole.entities.Employee.list('-created_date', 10000);
  } catch (e) {
    return Response.json({ ok: false, error: `employee_load_failed: ${e.message}` }, { status: 500 });
  }
  const byNorm = new Map();
  for (const emp of existing) byNorm.set(normalizeEmployeeCode(emp.employee_code), emp);

  const summary = { received: 0, created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawCode = (r[colCode] || '').trim();
    if (!rawCode) { summary.skipped += 1; continue; }
    summary.received += 1;

    const norm = normalizeEmployeeCode(rawCode);
    const data = {
      employee_code: rawCode, // preserve canonical from CSV
      employee_name: colName >= 0 ? (r[colName] || '').trim() : '',
      email: colEmail >= 0 ? (r[colEmail] || '').trim() : '',
      phone: colPhone >= 0 ? (r[colPhone] || '').trim() : '',
      department: colDept >= 0 ? (r[colDept] || '').trim() : '',
      designation: colDesig >= 0 ? (r[colDesig] || '').trim() : '',
      date_of_joining: colDoj >= 0 ? (r[colDoj] || '').trim() : '',
      is_active: true,
    };

    try {
      const match = byNorm.get(norm);
      if (match) {
        await base44.asServiceRole.entities.Employee.update(match.id, data);
        summary.updated += 1;
      } else {
        const created = await base44.asServiceRole.entities.Employee.create(data);
        byNorm.set(norm, created);
        summary.created += 1;
      }
    } catch (e) {
      summary.errors.push({ row: i + 1, code: rawCode, error: e.message });
    }
  }

  return Response.json({ ok: true, summary });
});