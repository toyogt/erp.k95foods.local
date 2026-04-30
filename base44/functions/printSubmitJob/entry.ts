// End-to-end: route → submit → audit. Failover only for transport/5xx errors.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIER_PREFERRED = 0;
const TIER_OTHER = 1000;

function genErpJobId() {
  return `PRINT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function buildWorkstationOrder({ preferredWorkstationId, fallbacks = [], workstations = [] }) {
  const activeIds = new Set(workstations.filter(w => w.is_active !== false).map(w => w.workstation_id));
  const order = []; const seen = new Set(); const tierMap = new Map();
  if (preferredWorkstationId && activeIds.has(preferredWorkstationId)) {
    order.push(preferredWorkstationId); seen.add(preferredWorkstationId); tierMap.set(preferredWorkstationId, TIER_PREFERRED);
  }
  if (preferredWorkstationId) {
    const ranked = fallbacks
      .filter(f => f.is_active !== false && f.primary_workstation_id === preferredWorkstationId && activeIds.has(f.fallback_workstation_id) && !seen.has(f.fallback_workstation_id))
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));
    for (const f of ranked) { order.push(f.fallback_workstation_id); seen.add(f.fallback_workstation_id); tierMap.set(f.fallback_workstation_id, f.rank || 999); }
  }
  for (const w of workstations) {
    if (w.is_active === false || seen.has(w.workstation_id)) continue;
    order.push(w.workstation_id); seen.add(w.workstation_id); tierMap.set(w.workstation_id, TIER_OTHER);
  }
  return { order, tierMap };
}

function isFresh(iso, secs, now) { if (!iso) return false; const t = Date.parse(iso); return !Number.isNaN(t) && (now - t) / 1000 <= secs; }
function sizeMatches(a, b) { if (!b) return true; if (!a) return false; return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }

function extractCandidates({ workstationId, probeMeta, config, request, tier, now }) {
  const out = []; const reasons = [];
  if (!probeMeta || !probeMeta.probe_ok) { reasons.push({ workstationId, reason: 'probe_failed', detail: probeMeta?.probe_error }); return { out, reasons }; }
  const snap = probeMeta.snapshot || {};
  const printers = Array.isArray(snap.active_printers) ? snap.active_printers : [];
  const agents = Array.isArray(snap.agents) ? snap.agents : [];
  const stale = config?.heartbeat_stale_seconds || 45;
  for (const p of printers) {
    if (!sizeMatches(p.size_code, request.label_size)) { reasons.push({ workstationId, printer: p.printer_name, reason: 'size_mismatch' }); continue; }
    if (!isFresh(p.heartbeat, stale, now)) { reasons.push({ workstationId, printer: p.printer_name, reason: 'heartbeat_stale' }); continue; }
    if (request.group) {
      const agent = agents.find(a => a.agent_id === p.agent_id);
      if (!(agent?.groups || []).includes(request.group)) { reasons.push({ workstationId, printer: p.printer_name, reason: 'group_unsupported' }); continue; }
    }
    out.push({
      workstation_id: workstationId, agent_id: p.agent_id, printer_name: p.printer_name, size_code: p.size_code,
      heartbeat: p.heartbeat, heartbeat_age_ms: Date.parse(p.heartbeat) ? now - Date.parse(p.heartbeat) : null,
      probe_latency_ms: probeMeta.probe_latency_ms ?? null, tier,
    });
  }
  return { out, reasons };
}

function rank(cands) {
  return [...cands].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const ageA = a.heartbeat_age_ms ?? Number.MAX_SAFE_INTEGER, ageB = b.heartbeat_age_ms ?? Number.MAX_SAFE_INTEGER;
    if (ageA !== ageB) return ageA - ageB;
    const latA = a.probe_latency_ms ?? Number.MAX_SAFE_INTEGER, latB = b.probe_latency_ms ?? Number.MAX_SAFE_INTEGER;
    if (latA !== latB) return latA - latB;
    if (a.workstation_id !== b.workstation_id) return a.workstation_id < b.workstation_id ? -1 : 1;
    return a.printer_name < b.printer_name ? -1 : 1;
  });
}

async function probeOne(baseUrl, token, timeoutMs) {
  const url = baseUrl.replace(/\/+$/, '') + '/v1/discovery';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { 'X-Auth-Token': token, 'Accept': 'application/json' }, signal: ctrl.signal });
    const latency = Date.now() - start;
    if (!res.ok) return { probe_ok: false, probe_latency_ms: latency, probe_error: `HTTP ${res.status}` };
    return { probe_ok: true, probe_latency_ms: latency, snapshot: await res.json().catch(() => ({})) };
  } catch (e) {
    return { probe_ok: false, probe_latency_ms: Date.now() - start, probe_error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
}

async function submit(baseUrl, token, payload, timeoutMs) {
  const url = baseUrl.replace(/\/+$/, '') + '/v1/jobs';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload), signal: ctrl.signal,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { source_type, source_value, label_size, template_id, copies = 1, preferred_workstation_id, group } = body;
    if (!source_type || !source_value) return Response.json({ error: 'source_type and source_value required' }, { status: 400 });
    if (!['path', 'url'].includes(source_type)) return Response.json({ error: 'invalid source_type' }, { status: 400 });
    if (!label_size && !template_id) return Response.json({ error: 'label_size or template_id required' }, { status: 400 });
    if (copies < 1 || copies > 200) return Response.json({ error: 'copies must be 1..200' }, { status: 400 });

    const erp_job_id = genErpJobId();
    const auditRow = await base44.asServiceRole.entities.PrintJobAudit.create({
      erp_job_id, source_type, source_value, label_size: label_size || '', template_id: template_id || '',
      copies, requested_workstation_id: preferred_workstation_id || '', status: 'ROUTING',
    });

    const [workstations, fallbacks, configs] = await Promise.all([
      base44.asServiceRole.entities.Workstation.filter({ is_active: true }),
      base44.asServiceRole.entities.WorkstationFallback.filter({ is_active: true }),
      base44.asServiceRole.entities.PrintServerConfig.filter({ is_active: true }),
    ]);
    const configByWid = new Map(configs.map(c => [c.workstation_id, c]));
    const { order, tierMap } = buildWorkstationOrder({ preferredWorkstationId: preferred_workstation_id, fallbacks, workstations });
    const probeTargets = order.filter(wid => configByWid.has(wid));
    const now = Date.now();

    const probeResults = await Promise.all(probeTargets.map(async (wid) => {
      const cfg = configByWid.get(wid);
      const token = Deno.env.get(cfg.auth_token_secret_name);
      if (!token) return [wid, { probe_ok: false, probe_latency_ms: 0, probe_error: 'token_secret_missing' }];
      return [wid, await probeOne(cfg.base_url, token, cfg.request_timeout_ms || 1200)];
    }));
    const probesByWid = new Map(probeResults);

    let candidates = []; const reasons = [];
    for (const wid of probeTargets) {
      const cfg = configByWid.get(wid);
      const tier = tierMap.get(wid) ?? 1000;
      const r = extractCandidates({ workstationId: wid, probeMeta: probesByWid.get(wid), config: cfg, request: { label_size, group }, tier, now });
      candidates = candidates.concat(r.out); reasons.push(...r.reasons);
    }
    const ranked = rank(candidates);
    const routing_trace = {
      order, probed: probeTargets, reasons,
      ranked: ranked.map(r => ({ workstation_id: r.workstation_id, printer_name: r.printer_name, agent_id: r.agent_id, tier: r.tier, heartbeat_age_ms: r.heartbeat_age_ms, probe_latency_ms: r.probe_latency_ms })),
    };

    if (ranked.length === 0) {
      await base44.asServiceRole.entities.PrintJobAudit.update(auditRow.id, {
        status: 'ROUTING_FAILED', routing_trace, error_info: { message: 'No candidate printers matched' },
      });
      return Response.json({ ok: false, erp_job_id, status: 'ROUTING_FAILED', error: 'No candidate printers', routing_trace }, { status: 422 });
    }

    let lastError = null; let chosen = null; let remoteResp = null;
    for (const cand of ranked) {
      const cfg = configByWid.get(cand.workstation_id);
      const token = Deno.env.get(cfg.auth_token_secret_name);
      if (!token) { lastError = { workstation_id: cand.workstation_id, error: 'token_secret_missing' }; continue; }
      const payload = {
        source: { type: source_type, value: source_value },
        ...(label_size ? { label_size } : {}), ...(template_id ? { template_id } : {}),
        copies,
        target: { workstation_id: cand.workstation_id, agent_id: cand.agent_id, printer: cand.printer_name, ...(group ? { group } : {}) },
        idempotency_key: erp_job_id,
        metadata: { routing_trace },
      };
      const resp = await submit(cfg.base_url, token, payload, cfg.request_timeout_ms || 1200);
      if (resp.status === 200 || resp.status === 201) { chosen = cand; remoteResp = resp; break; }
      if (resp.status >= 400 && resp.status < 500) { chosen = cand; remoteResp = resp; lastError = { workstation_id: cand.workstation_id, status: resp.status, body: resp.body }; break; }
      lastError = { workstation_id: cand.workstation_id, status: resp.status, error: resp.error || resp.body };
    }

    if (!remoteResp || (remoteResp.status !== 200 && remoteResp.status !== 201)) {
      await base44.asServiceRole.entities.PrintJobAudit.update(auditRow.id, {
        status: 'FAILED',
        selected_workstation_id: chosen?.workstation_id || '',
        selected_base_url: chosen ? configByWid.get(chosen.workstation_id).base_url : '',
        selected_agent_id: chosen?.agent_id || '',
        selected_printer: chosen?.printer_name || '',
        routing_trace, error_info: lastError || { message: 'All endpoints failed' },
      });
      return Response.json({ ok: false, erp_job_id, status: 'FAILED', error: lastError, routing_trace }, { status: 502 });
    }

    const remote_job_id = remoteResp.body?.job_id || remoteResp.body?.id || '';
    await base44.asServiceRole.entities.PrintJobAudit.update(auditRow.id, {
      status: 'SUBMITTED',
      selected_workstation_id: chosen.workstation_id,
      selected_base_url: configByWid.get(chosen.workstation_id).base_url,
      selected_agent_id: chosen.agent_id, selected_printer: chosen.printer_name,
      remote_job_id, routing_trace,
    });
    return Response.json({
      ok: true, erp_job_id, remote_job_id, status: 'SUBMITTED',
      selected: { workstation_id: chosen.workstation_id, agent_id: chosen.agent_id, printer: chosen.printer_name },
      routing_trace,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});