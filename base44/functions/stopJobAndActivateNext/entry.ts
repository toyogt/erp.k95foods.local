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

    // Update current job status
    await base44.entities.LabellingJob.update(job_id, {
      status: new_status,
      rejection_reason: remarks,
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
      details_json: { old_status: currentJob.status, new_status, remarks },
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

    return Response.json({
      success: true,
      stoppedJob: currentJob,
      activatedJob,
      message: `Job ${currentJob.job_id} marked as ${new_status}${activatedJob ? `. Next job ${activatedJob.job_id} activated.` : '. No pending jobs found.'}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});