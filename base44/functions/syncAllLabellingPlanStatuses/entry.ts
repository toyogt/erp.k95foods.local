import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Backfill sync: Updates all LabellingShiftPlan statuses based on their current job statuses.
 * Use this to sync plans that were created before the automation was set up.
 * 
 * Call this once to backfill all existing plans.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all plans
    const allPlans = await base44.entities.LabellingShiftPlan.list('-created_date', 1000);
    const allJobs = await base44.entities.LabellingJob.list('-created_date', 5000);

    if (!allPlans || allPlans.length === 0) {
      return Response.json({ success: true, message: 'No plans to sync', updated: 0 });
    }

    let updatedCount = 0;

    // Process each plan
    for (const plan of allPlans) {
      const planJobs = allJobs.filter(j => j.plan_id === plan.plan_id);

      if (planJobs.length === 0) continue;

      // Determine status
      let newStatus = 'locked';
      const completedCount = planJobs.filter(j => j.status === 'completed').length;
      const inProgressStatuses = ['active', 'bulk_printing', 'paused', 'demo_print_sent', 'demo_print_verified', 'checklist_submitted', 'bulk_printing_awaiting_printer_reset'];
      const inProgressCount = planJobs.filter(j => inProgressStatuses.includes(j.status)).length;

      if (completedCount === planJobs.length) {
        newStatus = 'completed';
      } else if (inProgressCount > 0) {
        newStatus = 'in_progress';
      }

      // Update if status changed
      if (plan.status !== newStatus) {
        await base44.entities.LabellingShiftPlan.update(plan.id, { status: newStatus });
        updatedCount++;
        console.log(`[syncPlanStatuses] Updated ${plan.plan_id}: "${plan.status}" → "${newStatus}" (${completedCount}/${planJobs.length} completed)`);
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${allPlans.length} plans, updated ${updatedCount}`,
      totalPlans: allPlans.length,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('[syncPlanStatuses] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});