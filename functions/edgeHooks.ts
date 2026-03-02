import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    // Get the edge endpoint from AppSettings
    let edgeUrl = null;
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'EDGE_ENDPOINT_URL' });
      if (settings.length > 0) edgeUrl = settings[0].value;
    } catch { /* no setting */ }

    if (!edgeUrl) {
      return Response.json({ success: false, edge_offline: true, message: 'Edge endpoint not configured (EDGE_ENDPOINT_URL missing in AppSettings)' });
    }

    const path = {
      start_job: '/edge/start_job',
      set_run_enable: '/edge/set_run_enable',
      soft_stop: '/edge/soft_stop',
      hard_stop: '/edge/hard_stop',
      printer_select_message: '/edge/printer/select_message',
      ryan_get_count: '/edge/ryan/get_count',
      ryan_start: '/edge/ryan/start',
      ryan_stop: '/edge/ryan/stop',
      ryan_print_sample: '/edge/ryan/print_sample',
    }[action];

    if (!path) return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });

    const resp = await fetch(edgeUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });

    const data = await resp.json().catch(() => ({}));
    return Response.json({ success: resp.ok, status: resp.status, data });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.code === 'ECONNREFUSED') {
      return Response.json({ success: false, edge_offline: true, message: 'Edge device unreachable' });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});