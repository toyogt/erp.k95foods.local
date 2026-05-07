import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Updates the status of a LabellingShiftPlan based on the statuses of its child LabellingJob records.
 * 
 * Triggered when a LabellingJob is updated.
 * 
 * Status Logic:
 * - If ALL jobs are 'completed' → plan status = 'completed'
 * - If ANY job is 'active', 'bulk_printing', 'paused', or 'demo_print_sent' → plan status = 'in_progress'
 * - Otherwise → plan status = 'locked' (default for active plans)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { event, data } = payload;

    // Ensure we have the updated job data
    if (!data?.plan_id || !event?.entity_id) {
      return Response.json({ error: 'Missing plan_id or job id' }, { status: 400 });
    }

    const planId = data.plan_id;
    const jobId = event.entity_id;

    // Fetch all jobs for this plan
    const allJobs = await base44.entities.LabellingJob.filter({ plan_id: planId });

    if (!allJobs || allJobs.length === 0) {
      console.log(`[updatePlanStatus] No jobs found for plan ${planId}`);
      return Response.json({ success: true, message: 'No jobs to process' });
    }

    // Determine plan status based on job statuses
    let newPlanStatus = 'locked'; // default

    const completedCount = allJobs.filter(j => j.status === 'completed').length;
    const inProgressStatuses = ['active', 'bulk_printing', 'paused', 'demo_print_sent', 'demo_print_verified', 'checklist_submitted', 'bulk_printing_awaiting_printer_reset'];
    const inProgressCount = allJobs.filter(j => inProgressStatuses.includes(j.status)).length;

    if (completedCount === allJobs.length) {
      // All jobs completed
      newPlanStatus = 'completed';
    } else if (inProgressCount > 0) {
      // At least one job in progress
      newPlanStatus = 'in_progress';
    }

    // Fetch the current plan
    const plans = await base44.entities.LabellingShiftPlan.filter({ plan_id: planId });
    if (!plans || plans.length === 0) {
      console.log(`[updatePlanStatus] Plan ${planId} not found`);
      return Response.json({ error: 'Plan not found' }, { status: 404 });
    }

    const plan = plans[0];

    // Only update if status has changed
    if (plan.status !== newPlanStatus) {
      await base44.entities.LabellingShiftPlan.update(plan.id, {
        status: newPlanStatus,
      });

      console.log(`[updatePlanStatus] Updated plan ${planId} status from "${plan.status}" to "${newPlanStatus}" (completed: ${completedCount}/${allJobs.length})`);
    } else {
      console.log(`[updatePlanStatus] Plan ${planId} status unchanged: ${newPlanStatus}`);
    }

    return Response.json({
      success: true,
      planId,
      newStatus: newPlanStatus,
      completedJobs: completedCount,
      totalJobs: allJobs.length,
    });
  } catch (error) {
    console.error('[updatePlanStatus] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});