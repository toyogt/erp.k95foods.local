import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Scheduled function — check for chamber cycle checks overdue by >10 minutes
 * and create AlertEvent if not already alerted.
 * Called by automation every 5 minutes.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    // Get all running cycles
    const runningCycles = await base44.asServiceRole.entities.ChamberCycle.filter(
      { status: 'RUNNING' }, '-started_at', 50
    );

    if (!runningCycles.length) {
      return Response.json({ checked: 0, alerted: 0 });
    }

    // Get incomplete checks for running cycles that are overdue by >10 min
    const allChecks = await base44.asServiceRole.entities.ChamberCycleCheck.filter(
      {}, '-due_at', 200
    );

    let alerted = 0;
    const runningCycleIds = new Set(runningCycles.map(c => c.cycle_id));

    // Recent existing alerts to avoid duplicate spam (last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const recentAlerts = await base44.asServiceRole.entities.AlertEvent.filter(
      { station_type: 'CHAMBER', status: 'OPEN' }, '-created_at', 50
    ).catch(() => []);
    const recentAlertMessages = new Set(recentAlerts.map(a => a.message));

    for (const check of allChecks) {
      if (!runningCycleIds.has(check.cycle_id)) continue;
      if (check.completed_at) continue; // already done
      if (!check.due_at) continue;
      if (check.due_at > tenMinAgo) continue; // not overdue enough

      const cycle = runningCycles.find(c => c.cycle_id === check.cycle_id);
      const machineId = cycle?.chamber_machine_id || 'Unknown';
      const msg = `Cycle check overdue on ${machineId} — cycle ${check.cycle_id} (${check.check_type})`;

      if (recentAlertMessages.has(msg)) continue; // already alerted recently

      await base44.asServiceRole.entities.AlertEvent.create({
        event_id: `ALT-${Date.now().toString(36).toUpperCase()}-${alerted}`,
        severity: 'WARN',
        station_type: 'CHAMBER',
        reference_type: 'ChamberCycle',
        reference_id: check.cycle_id,
        message: msg,
        created_at: now.toISOString(),
        status: 'OPEN',
      });

      recentAlertMessages.add(msg);
      alerted++;
    }

    return Response.json({ checked: runningCycles.length, alerted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});