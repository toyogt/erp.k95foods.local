import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, new_status, remarks } = await req.json();

    if (!job_id || !new_status || !remarks) {
      return Response.json(
        { error: 'Missing required fields: job_id, new_status, remarks' },
        { status: 400 }
      );
    }

    if (!['cancelled', 'on_hold'].includes(new_status)) {
      return Response.json(
        { error: 'Invalid new_status. Must be "cancelled" or "on_hold"' },
        { status: 400 }
      );
    }

    // Fetch the current job
    const currentJob = await base44.entities.LabellingJob.get(job_id);
    if (!currentJob) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // ── Send STOP command to printer (best-effort) ──────────────────────
    // Only attempt if the job is in a state where the printer might be running.
    // We don't block the status change on printer reachability.
    let printerStopResult = { attempted: false, success: false, error: null };
    const PRINTING_STATUSES = [
      'bulk_printing',
      'bulk_printing_awaiting_printer_reset',
      'paused',
      'demo_print_sent',
    ];
    if (PRINTING_STATUSES.includes(currentJob.status) && currentJob.line_id) {
      printerStopResult.attempted = true;
      try {
        const printers = await base44.asServiceRole.entities.LblPrinterConfig.filter({
          line_id: currentJob.line_id,
          is_active: true,
        });
        const printer = printers?.[0];
        if (printer?.ip_address && printer?.port) {
          const base = (printer.middleware_base_url || '').replace(/\/$/, '');
          const endpoint = `${base}/print`;
          const headers = { 'Content-Type': 'application/json' };
          if (printer.auth_token) headers['Authorization'] = `Bearer ${printer.auth_token}`;

          const stopPayload = {
            printer_id: printer.printer_id,
            printer: { ip: printer.ip_address, port: printer.port },
            command: { command: 'STOP' },
          };

          const controller = new AbortController();
          const timeoutMs = printer.request_timeout_ms || 15000;
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(stopPayload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          printerStopResult.success = response.ok;
          if (!response.ok) {
            printerStopResult.error = `Middleware returned ${response.status}`;
          }

          // Log the printer command for audit
          await base44.asServiceRole.entities.LblPrintCommand.create({
            command_id: `CMD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            job_id: currentJob.job_id,
            printer_id: printer.printer_id,
            endpoint_url: endpoint,
            command_type: 'bulk_stop',
            status: response.ok ? 'sent' : 'failed',
            request_payload: stopPayload,
            response_status_code: response.status,
            error_message: response.ok ? null : `Stop command failed: ${response.status}`,
            sent_at: new Date().toISOString(),
            sent_by: user.email,
          });
        } else {
          printerStopResult.error = 'No active printer configured for this line';
        }
      } catch (printerErr) {
        printerStopResult.error = printerErr.message || 'Unknown printer error';
        console.error('Printer STOP command failed:', printerErr);
      }
    }

    // Update current job status
    await base44.entities.LabellingJob.update(job_id, {
      status: new_status,
      rejection_reason: remarks,
      current_printed_qty: currentJob.current_printed_qty || 0,
    });

    // Log the action
    await base44.entities.LblEventLog.create({
      event_id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      job_id: currentJob.job_id,
      plan_id: currentJob.plan_id,
      action_type: new_status === 'cancelled' ? 'job_cancelled' : 'job_paused',
      description: `Job ${new_status} by ${user.full_name}: ${remarks}`,
      performed_by_email: user.email,
      performed_by_name: user.full_name,
      timestamp: new Date().toISOString(),
      details_json: { old_status: currentJob.status, new_status, remarks, printer_stop: printerStopResult },
    });

    // Find next pending job in the same plan with higher priority order
    const jobsInPlan = await base44.entities.LabellingJob.filter({
      plan_id: currentJob.plan_id,
    });

    const nextJob = jobsInPlan
      .filter(j => j.status === 'pending')
      .sort((a, b) => a.priority_order - b.priority_order)[0];

    let activatedJob = null;
    if (nextJob) {
      await base44.entities.LabellingJob.update(nextJob.id, {
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: user.full_name || user.email,
      });

      // Log activation
      await base44.entities.LblEventLog.create({
        event_id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        job_id: nextJob.job_id,
        plan_id: nextJob.plan_id,
        action_type: 'job_started',
        description: `Job auto-activated as next priority after ${currentJob.job_id} was ${new_status}`,
        performed_by_email: user.email,
        performed_by_name: user.full_name,
        timestamp: new Date().toISOString(),
      });

      activatedJob = nextJob;
    }

    const printerMsg = printerStopResult.attempted
      ? (printerStopResult.success ? ' Printer stopped.' : ` Printer stop failed: ${printerStopResult.error}.`)
      : '';

    return Response.json({
      success: true,
      stoppedJob: currentJob,
      activatedJob,
      printerStopResult,
      message: `Job ${currentJob.job_id} marked as ${new_status}.${printerMsg}${activatedJob ? ` Next job ${activatedJob.job_id} activated.` : ' No pending jobs found.'}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});