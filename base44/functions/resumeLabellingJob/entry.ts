import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only supervisors and admins can resume on-hold jobs
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return Response.json(
        { error: 'Forbidden: Only supervisors or admins can resume on-hold jobs' },
        { status: 403 }
      );
    }

    const { job_id, resume_reason } = await req.json();

    if (!job_id || !resume_reason) {
      return Response.json(
        { error: 'Missing required fields: job_id, resume_reason' },
        { status: 400 }
      );
    }

    // Fetch the current job
    const currentJob = await base44.entities.LabellingJob.get(job_id);
    if (!currentJob) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    if (currentJob.status !== 'on_hold') {
      return Response.json(
        { error: `Cannot resume job — current status is "${currentJob.status}". Only on-hold jobs can be resumed.` },
        { status: 400 }
      );
    }

    // Determine which status to restore. If previous_status is missing (legacy jobs),
    // fall back to 'pending' so the job re-enters the queue safely.
    const restoredStatus = currentJob.previous_status || 'pending';

    await base44.entities.LabellingJob.update(job_id, {
      status: restoredStatus,
      previous_status: null,
      rejection_reason: null,
    });

    // Log the resume action
    await base44.entities.LblEventLog.create({
      event_id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      job_id: currentJob.job_id,
      plan_id: currentJob.plan_id,
      action_type: 'job_resumed',
      description: `Job resumed from on_hold by ${user.full_name}: ${resume_reason}. Restored to status "${restoredStatus}".`,
      performed_by_email: user.email,
      performed_by_name: user.full_name,
      timestamp: new Date().toISOString(),
      details_json: {
        old_status: 'on_hold',
        restored_status: restoredStatus,
        resume_reason,
      },
    });

    return Response.json({
      success: true,
      job: { ...currentJob, status: restoredStatus },
      message: `Job ${currentJob.job_id} resumed. Status restored to "${restoredStatus}".`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});