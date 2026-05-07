// Returns merged active printers/workstations from latest probe cache.
// { refresh: true } forces re-probe of all active workstations first.
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const refresh = !!body.refresh;

    const [workstations, configs] = await Promise.all([
      base44.asServiceRole.entities.Workstation.filter({ is_active: true }),
      base44.asServiceRole.entities.PrintServerConfig.filter({ is_active: true }),
    ]);
    const configByWid = new Map(configs.map(c => [c.workstation_id, c]));

    if (refresh) {
      await Promise.all(workstations.filter(w => configByWid.has(w.workstation_id)).map(async (w) => {
        const cfg = configByWid.get(w.workstation_id);
        const token = Deno.env.get(cfg.auth_token_secret_name);
        const result = token
          ? await probe(cfg.base_url, token, cfg.request_timeout_ms || 1200)
          : { ok: false, latency: 0, error: 'token_secret_missing' };
        const existing = await base44.asServiceRole.entities.PrinterDiscoveryCache.filter({ workstation_id: w.workstation_id });
        const payload = {
          workstation_id: w.workstation_id,
          snapshot: result.snapshot || {},
          last_probe_at: new Date().toISOString(),
          probe_ok: result.ok,
          probe_latency_ms: result.latency,
          probe_error: result.ok ? '' : (result.error || ''),
        };
        if (existing[0]) await base44.asServiceRole.entities.PrinterDiscoveryCache.update(existing[0].id, payload);
        else await base44.asServiceRole.entities.PrinterDiscoveryCache.create(payload);
      }));
    }

    const cacheRows = await base44.asServiceRole.entities.PrinterDiscoveryCache.list();
    const cacheByWid = new Map(cacheRows.map(c => [c.workstation_id, c]));

    const rows = [];
    for (const w of workstations) {
      const cfg = configByWid.get(w.workstation_id);
      const cache = cacheByWid.get(w.workstation_id);
      const printers = cache?.snapshot?.active_printers || [];
      if (printers.length === 0) {
        rows.push({
          workstation_id: w.workstation_id, display_name: w.display_name,
          base_url: cfg?.base_url || '',
          probe_ok: cache?.probe_ok ?? false, probe_latency_ms: cache?.probe_latency_ms ?? null,
          last_probe_at: cache?.last_probe_at || null, probe_error: cache?.probe_error || '',
          printer_name: '', size_code: '', heartbeat: '',
        });
      } else {
        for (const p of printers) {
          rows.push({
            workstation_id: w.workstation_id, display_name: w.display_name,
            base_url: cfg?.base_url || '',
            probe_ok: cache?.probe_ok ?? false, probe_latency_ms: cache?.probe_latency_ms ?? null,
            last_probe_at: cache?.last_probe_at || null, probe_error: cache?.probe_error || '',
            printer_name: p.printer_name || '', agent_id: p.agent_id || '',
            size_code: p.size_code || '',
            roll_width: p.roll_width || null, roll_height: p.roll_height || null,
            heartbeat: p.heartbeat || '',
          });
        }
      }
    }
    return Response.json({ ok: true, rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});