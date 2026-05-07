// Poll selected endpoint for a job's latest status and update PrintJobAudit.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TERMINAL = ['SUCCESS', 'FAILED'];
const ALLOWED = ['ROUTING','SUBMITTED','QUEUED','ASSIGNED','DOWNLOADING','RENDERING','PRINTING','SUCCESS','FAILED','ROUTING_FAILED'];

function normalize(s) {
  if (!s) return null;
  const up = String(s).toUpperCase();
  return ALLOWED.includes(up) ? up : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { erp_job_id } = body;
    if (!erp_job_id) return Response.json({ error: 'erp_job_id required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.PrintJobAudit.filter({ erp_job_id });
    const audit = rows[0];
    if (!audit) return Response.json({ error: 'Job not found' }, { status: 404 });

    if (TERMINAL.includes(audit.status)) {
      return Response.json({ ok: true, status: audit.status, terminal: true, audit });
    }
    if (!audit.remote_job_id || !audit.selected_workstation_id) {
      return Response.json({ ok: true, status: audit.status, terminal: false, audit });
    }

    const configs = await base44.asServiceRole.entities.PrintServerConfig.filter({ workstation_id: audit.selected_workstation_id });
    const cfg = configs[0];
    if (!cfg) return Response.json({ error: 'Selected workstation config missing' }, { status: 404 });
    const token = Deno.env.get(cfg.auth_token_secret_name);
    if (!token) return Response.json({ error: 'Token secret missing' }, { status: 500 });

    const url = `${cfg.base_url.replace(/\/+$/, '')}/v1/jobs/${encodeURIComponent(audit.remote_job_id)}?include_events=true`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), cfg.request_timeout_ms || 1200);
    let remote = null;
    try {
      const res = await fetch(url, { headers: { 'X-Auth-Token': token, 'Accept': 'application/json' }, signal: ctrl.signal });
      remote = { status: res.status, body: await res.json().catch(() => ({})) };
    } catch (e) {
      return Response.json({ error: e.name === 'AbortError' ? 'timeout' : e.message }, { status: 502 });
    } finally { clearTimeout(t); }

    if (remote.status !== 200) return Response.json({ error: `Remote ${remote.status}`, body: remote.body }, { status: 502 });

    const newStatus = normalize(remote.body?.status);
    const events = remote.body?.events || [];
    const patch = { routing_trace: { ...(audit.routing_trace || {}), last_remote_events: events.slice(-20) } };
    if (newStatus && newStatus !== audit.status) patch.status = newStatus;
    const updated = await base44.asServiceRole.entities.PrintJobAudit.update(audit.id, patch);

    return Response.json({
      ok: true, status: patch.status || audit.status,
      terminal: TERMINAL.includes(patch.status || audit.status),
      audit: updated, events,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});