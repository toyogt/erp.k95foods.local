// Probe one workstation's print agent at GET {base_url}/v1/discovery.
// Token resolved server-side; never returned to caller.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function probe(baseUrl, token, timeoutMs) {
  const url = baseUrl.replace(/\/+$/, '') + '/v1/discovery';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { 'X-Auth-Token': token, 'Accept': 'application/json' }, signal: ctrl.signal });
    const latency = Date.now() - start;
    if (!res.ok) return { ok: false, latency, error: `HTTP ${res.status}` };
    return { ok: true, latency, snapshot: await res.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, latency: Date.now() - start, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
}

async function upsertCache(base44, workstation_id, result) {
  const existing = await base44.asServiceRole.entities.PrinterDiscoveryCache.filter({ workstation_id });
  const payload = {
    workstation_id,
    snapshot: result.snapshot || {},
    last_probe_at: new Date().toISOString(),
    probe_ok: result.ok,
    probe_latency_ms: result.latency,
    probe_error: result.ok ? '' : (result.error || ''),
  };
  if (existing[0]) await base44.asServiceRole.entities.PrinterDiscoveryCache.update(existing[0].id, payload);
  else await base44.asServiceRole.entities.PrinterDiscoveryCache.create(payload);
  return payload;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const workstation_id = body.workstation_id;
    if (!workstation_id) return Response.json({ error: 'workstation_id required' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.PrintServerConfig.filter({ workstation_id, is_active: true });
    const config = configs[0];
    if (!config) return Response.json({ error: 'No active PrintServerConfig for workstation' }, { status: 404 });

    const secretName = config.auth_token_secret_name;
    const token = Deno.env.get(secretName);
    if (!token) {
      const cached = await upsertCache(base44, workstation_id, { ok: false, latency: 0, error: 'token_secret_missing' });
      return Response.json({
        ok: false,
        error: `Token secret '${secretName}' not configured. Available env keys: ${Object.keys(Deno.env.toObject()).filter(k => !['HOME','PATH','PWD'].includes(k)).join(', ')}`,
        cache: cached,
      }, { status: 500 });
    }

    const result = await probe(config.base_url, token, config.request_timeout_ms || 1200);
    const cached = await upsertCache(base44, workstation_id, result);

    return Response.json({
      ok: result.ok,
      workstation_id,
      probe_latency_ms: result.latency,
      probe_error: result.ok ? null : result.error,
      snapshot: result.snapshot || null,
      cache: cached,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});