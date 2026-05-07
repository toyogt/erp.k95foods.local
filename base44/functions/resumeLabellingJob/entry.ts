import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only supervisors and admins (incl. lbl_supervisor) can resume on-hold jobs
    if (!['admin', 'supervisor', 'lbl_supervisor'].includes(user.role)) {
      return Response.json(
        { error: 'Forbidden: Only supervisors or admins can resume on-hold jobs' },
        { status: 403 }
      );
    }

    const { job_id, resume_reason, updated_planned_quantity } = await req.json();

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

    // Validate & apply optional planned-quantity update
    const updatePayload = {
      status: restoredStatus,
      previous_status: null,
      rejection_reason: null,
    };
    let quantityChanged = false;
    const oldPlanned = currentJob.quantity_bottles_planned || 0;
    const printedSoFar = currentJob.current_printed_qty || 0;

    if (updated_planned_quantity !== undefined && updated_planned_quantity !== null) {
      const newQty = Number(updated_planned_quantity);
      if (!Number.isFinite(newQty) || newQty < 0) {
        return Response.json({ error: 'Invalid planned quantity.' }, { status: 400 });
      }
      if (newQty < printedSoFar) {
        return Response.json(
          { error: `New planned quantity (${newQty}) cannot be less than already printed (${printedSoFar}).` },
          { status: 400 }
        );
      }
      if (newQty !== oldPlanned) {
        updatePayload.quantity_bottles_planned = newQty;
        quantityChanged = true;
      }
    }

    await base44.entities.LabellingJob.update(job_id, updatePayload);

    // Log the resume action
    await base44.entities.LblEventLog.create({
      event_id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      job_id: currentJob.job_id,
      plan_id: currentJob.plan_id,
      action_type: 'job_resumed',
      description: `Job resumed from on_hold by ${user.full_name}: ${resume_reason}. Restored to status "${restoredStatus}".` +
        (quantityChanged ? ` Planned quantity updated from ${oldPlanned} to ${updatePayload.quantity_bottles_planned} bottles.` : ''),
      performed_by_email: user.email,
      performed_by_name: user.full_name,
      timestamp: new Date().toISOString(),
      details_json: {
        old_status: 'on_hold',
        restored_status: restoredStatus,
        resume_reason,
        old_planned_quantity: oldPlanned,
        new_planned_quantity: quantityChanged ? updatePayload.quantity_bottles_planned : oldPlanned,
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