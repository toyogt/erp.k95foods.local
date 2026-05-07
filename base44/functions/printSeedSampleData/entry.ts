// Admin-only: seeds sample workstations, configs, and a fallback chain.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const ws = [
      { workstation_id: 'PACK-PC-01', display_name: 'Packing Line 1 PC', location: 'Packing Zone A', department: 'Packing', is_active: true },
      { workstation_id: 'PACK-PC-02', display_name: 'Packing Line 2 PC', location: 'Packing Zone A', department: 'Packing', is_active: true },
      { workstation_id: 'WH-PC-01', display_name: 'Warehouse Dispatch PC', location: 'Warehouse', department: 'Warehouse', is_active: true },
    ];
    const cfgs = [
      { print_server_config_id: 'PSC-PACK-01', workstation_id: 'PACK-PC-01', base_url: 'http://192.168.1.101:8089', auth_token_secret_name: 'PRINT_AGENT_TOKEN_PACK_01', request_timeout_ms: 1200, heartbeat_stale_seconds: 45, is_active: true, description: 'Packing Line 1 print agent' },
      { print_server_config_id: 'PSC-PACK-02', workstation_id: 'PACK-PC-02', base_url: 'http://192.168.1.102:8089', auth_token_secret_name: 'PRINT_AGENT_TOKEN_PACK_02', request_timeout_ms: 1200, heartbeat_stale_seconds: 45, is_active: true, description: 'Packing Line 2 print agent' },
      { print_server_config_id: 'PSC-WH-01', workstation_id: 'WH-PC-01', base_url: 'http://192.168.1.110:8089', auth_token_secret_name: 'PRINT_AGENT_TOKEN_WH_01', request_timeout_ms: 1500, heartbeat_stale_seconds: 60, is_active: true, description: 'Warehouse dispatch print agent' },
    ];
    const fbs = [
      { primary_workstation_id: 'PACK-PC-01', fallback_workstation_id: 'PACK-PC-02', rank: 1, is_active: true },
      { primary_workstation_id: 'PACK-PC-01', fallback_workstation_id: 'WH-PC-01', rank: 2, is_active: true },
      { primary_workstation_id: 'PACK-PC-02', fallback_workstation_id: 'PACK-PC-01', rank: 1, is_active: true },
    ];

    const upsert = async (Entity, where, data) => {
      const existing = await Entity.filter(where);
      if (existing[0]) return Entity.update(existing[0].id, data);
      return Entity.create(data);
    };

    for (const w of ws) await upsert(base44.asServiceRole.entities.Workstation, { workstation_id: w.workstation_id }, w);
    for (const c of cfgs) await upsert(base44.asServiceRole.entities.PrintServerConfig, { print_server_config_id: c.print_server_config_id }, c);
    for (const f of fbs) await upsert(base44.asServiceRole.entities.WorkstationFallback, { primary_workstation_id: f.primary_workstation_id, fallback_workstation_id: f.fallback_workstation_id }, f);

    return Response.json({ ok: true, seeded: { workstations: ws.length, configs: cfgs.length, fallbacks: fbs.length } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});