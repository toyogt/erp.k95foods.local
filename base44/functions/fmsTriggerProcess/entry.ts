import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Calculate deadline from activation time based on TAT settings
function calculateDeadline(activatedAt, tatType, tatValue, tatTime) {
  const base = new Date(activatedAt);

  if (tatType === 'fixed_hours') {
    const hours = tatValue || 24;
    return new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  if (tatType === 'end_of_day') {
    const eod = new Date(base);
    const [h, m] = (tatTime || '18:00').split(':').map(Number);
    eod.setHours(h, m, 0, 0);
    if (eod <= base) eod.setDate(eod.getDate() + 1);
    return eod.toISOString();
  }

  if (tatType === 'fixed_clock_time') {
    const target = new Date(base);
    const [h, m] = (tatTime || '17:00').split(':').map(Number);
    target.setHours(h, m, 0, 0);
    if (target <= base) target.setDate(target.getDate() + 1);
    return target.toISOString();
  }

  if (tatType === 'business_days') {
    const days = tatValue || 1;
    let count = 0;
    const cur = new Date(base);
    while (count < days) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    cur.setHours(18, 0, 0, 0);
    return cur.toISOString();
  }

  // fallback: 24 hours
  return new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── ACTION: trigger (start a new process instance) ──────────────────────
    if (action === 'trigger') {
      const { process_id, trigger_data, title, trigger_source, trigger_ref_id } = body;
      if (!process_id) return Response.json({ error: 'process_id required' }, { status: 400 });

      // Load process template
      const processes = await base44.asServiceRole.entities.FMSProcess.filter({ id: process_id });
      const process = processes[0];
      if (!process) return Response.json({ error: 'Process not found' }, { status: 404 });

      // Load steps ordered
      const allSteps = await base44.asServiceRole.entities.FMSProcessStep.filter({ process_id });
      allSteps.sort((a, b) => a.step_order - b.step_order);
      if (allSteps.length === 0) return Response.json({ error: 'Process has no steps' }, { status: 400 });

      const now = new Date().toISOString();

      // Create process instance
      const instance = await base44.asServiceRole.entities.FMSProcessInstance.create({
        process_id,
        process_name: process.name,
        status: 'active',
        triggered_by: user.email,
        triggered_at: now,
        trigger_data: trigger_data || {},
        current_step_order: 1,
        total_steps: allSteps.length,
        trigger_source: trigger_source || 'manual',
        trigger_ref_id: trigger_ref_id || null,
        title: title || `${process.name} — ${new Date(now).toLocaleDateString('en-IN')}`,
      });

      // Activate Step 1
      const step1 = allSteps[0];
      const deadline = calculateDeadline(now, step1.tat_type, step1.tat_value, step1.tat_time);

      await base44.asServiceRole.entities.FMSStepInstance.create({
        instance_id: instance.id,
        process_id,
        step_id: step1.id,
        step_order: step1.step_order,
        step_name: step1.name,
        description: step1.description || '',
        instructions: step1.instructions || '',
        assignee_email: step1.assignee_email,
        assignee_name: step1.assignee_name || '',
        status: 'active',
        activated_at: now,
        deadline,
        completion_mode: step1.completion_mode || 'manual',
        tat_type: step1.tat_type,
        tat_value: step1.tat_value,
        tat_time: step1.tat_time || '',
      });

      return Response.json({ success: true, instance_id: instance.id, message: 'Process started' });
    }

    // ── ACTION: complete_step ────────────────────────────────────────────────
    if (action === 'complete_step') {
      const { step_instance_id, completion_note, completed_by_override } = body;
      if (!step_instance_id) return Response.json({ error: 'step_instance_id required' }, { status: 400 });

      const stepInstances = await base44.asServiceRole.entities.FMSStepInstance.filter({ id: step_instance_id });
      const stepInst = stepInstances[0];
      if (!stepInst) return Response.json({ error: 'Step instance not found' }, { status: 404 });
      if (stepInst.status !== 'active') return Response.json({ error: 'Step is not active' }, { status: 400 });

      const now = new Date().toISOString();
      const completedBy = completed_by_override || user.email;

      // Mark step complete
      await base44.asServiceRole.entities.FMSStepInstance.update(step_instance_id, {
        status: 'completed',
        completed_at: now,
        completed_by: completedBy,
        completion_note: completion_note || '',
      });

      // Load process instance
      const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
      const instance = instances[0];
      if (!instance) return Response.json({ success: true, message: 'Step completed' });

      // Load all steps for the process
      const allSteps = await base44.asServiceRole.entities.FMSProcessStep.filter({ process_id: instance.process_id });
      allSteps.sort((a, b) => a.step_order - b.step_order);

      const nextStepTemplate = allSteps.find(s => s.step_order === stepInst.step_order + 1);

      if (!nextStepTemplate) {
        // All steps done — complete the instance
        await base44.asServiceRole.entities.FMSProcessInstance.update(instance.id, {
          status: 'completed',
          completed_at: now,
          current_step_order: stepInst.step_order,
        });
        return Response.json({ success: true, message: 'Process completed', process_completed: true });
      }

      // Activate next step
      const deadline = calculateDeadline(now, nextStepTemplate.tat_type, nextStepTemplate.tat_value, nextStepTemplate.tat_time);

      await base44.asServiceRole.entities.FMSStepInstance.create({
        instance_id: instance.id,
        process_id: instance.process_id,
        step_id: nextStepTemplate.id,
        step_order: nextStepTemplate.step_order,
        step_name: nextStepTemplate.name,
        description: nextStepTemplate.description || '',
        instructions: nextStepTemplate.instructions || '',
        assignee_email: nextStepTemplate.assignee_email,
        assignee_name: nextStepTemplate.assignee_name || '',
        status: 'active',
        activated_at: now,
        deadline,
        completion_mode: nextStepTemplate.completion_mode || 'manual',
        tat_type: nextStepTemplate.tat_type,
        tat_value: nextStepTemplate.tat_value,
        tat_time: nextStepTemplate.tat_time || '',
      });

      await base44.asServiceRole.entities.FMSProcessInstance.update(instance.id, {
        current_step_order: nextStepTemplate.step_order,
      });

      return Response.json({ success: true, message: 'Step completed, next step activated' });
    }

    // ── ACTION: auto_complete (triggered internally from app events) ─────────
    if (action === 'auto_complete') {
      const { auto_complete_event, trigger_ref_id } = body;
      if (!auto_complete_event) return Response.json({ error: 'auto_complete_event required' }, { status: 400 });

      // Find active step instances with this auto-complete event
      const allActive = await base44.asServiceRole.entities.FMSStepInstance.filter({ status: 'active' });
      const matchingSteps = allActive.filter(s =>
        s.completion_mode === 'auto'
      );

      // For each matching step, check if its template has the matching auto_complete_event
      const results = [];
      for (const stepInst of matchingSteps) {
        if (!stepInst.step_id) continue;
        const stepTemplates = await base44.asServiceRole.entities.FMSProcessStep.filter({ id: stepInst.step_id });
        const stepTemplate = stepTemplates[0];
        if (!stepTemplate) continue;
        if (stepTemplate.auto_complete_event !== auto_complete_event) continue;

        // Optionally match trigger_ref_id
        if (trigger_ref_id) {
          const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
          const inst = instances[0];
          if (!inst || inst.trigger_ref_id !== trigger_ref_id) continue;
        }

        // Complete this step
        const completeReq = new Request(req.url, {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify({
            action: 'complete_step',
            step_instance_id: stepInst.id,
            completion_note: `Auto-completed by event: ${auto_complete_event}`,
            completed_by_override: 'system',
          }),
        });
        // Inline complete instead of re-calling
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.FMSStepInstance.update(stepInst.id, {
          status: 'completed',
          completed_at: now,
          completed_by: 'system (auto)',
          completion_note: `Auto-completed by event: ${auto_complete_event}`,
        });

        const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
        const instance = instances[0];
        if (instance) {
          const allSteps = await base44.asServiceRole.entities.FMSProcessStep.filter({ process_id: instance.process_id });
          allSteps.sort((a, b) => a.step_order - b.step_order);
          const nextStepTemplate = allSteps.find(s => s.step_order === stepInst.step_order + 1);

          if (!nextStepTemplate) {
            await base44.asServiceRole.entities.FMSProcessInstance.update(instance.id, {
              status: 'completed',
              completed_at: now,
            });
          } else {
            const deadline = calculateDeadline(now, nextStepTemplate.tat_type, nextStepTemplate.tat_value, nextStepTemplate.tat_time);
            await base44.asServiceRole.entities.FMSStepInstance.create({
              instance_id: instance.id,
              process_id: instance.process_id,
              step_id: nextStepTemplate.id,
              step_order: nextStepTemplate.step_order,
              step_name: nextStepTemplate.name,
              description: nextStepTemplate.description || '',
              instructions: nextStepTemplate.instructions || '',
              assignee_email: nextStepTemplate.assignee_email,
              assignee_name: nextStepTemplate.assignee_name || '',
              status: 'active',
              activated_at: now,
              deadline,
              completion_mode: nextStepTemplate.completion_mode || 'manual',
              tat_type: nextStepTemplate.tat_type,
              tat_value: nextStepTemplate.tat_value,
              tat_time: nextStepTemplate.tat_time || '',
            });
            await base44.asServiceRole.entities.FMSProcessInstance.update(instance.id, {
              current_step_order: nextStepTemplate.step_order,
            });
          }
        }
        results.push(stepInst.id);
      }
      return Response.json({ success: true, auto_completed: results.length, step_ids: results });
    }

    // ── ACTION: reassign ─────────────────────────────────────────────────────
    if (action === 'reassign') {
      const { step_instance_id, new_assignee_email, new_assignee_name, reason } = body;
      if (!step_instance_id || !new_assignee_email) return Response.json({ error: 'step_instance_id and new_assignee_email required' }, { status: 400 });

      const stepInstances = await base44.asServiceRole.entities.FMSStepInstance.filter({ id: step_instance_id });
      const stepInst = stepInstances[0];
      if (!stepInst) return Response.json({ error: 'Step instance not found' }, { status: 404 });

      const oldAssignee = stepInst.assignee_email;

      await base44.asServiceRole.entities.FMSStepInstance.update(step_instance_id, {
        assignee_email: new_assignee_email,
        assignee_name: new_assignee_name || new_assignee_email,
        reassigned_from: oldAssignee,
      });

      const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
      const instance = instances[0];

      await base44.asServiceRole.entities.FMSEscalationLog.create({
        instance_id: stepInst.instance_id,
        step_instance_id,
        step_name: stepInst.step_name,
        process_name: instance?.process_name || '',
        action_type: 'reassignment',
        performed_by: user.email,
        target_email: new_assignee_email,
        message: reason || `Reassigned from ${oldAssignee} to ${new_assignee_email}`,
        performed_at: new Date().toISOString(),
        from_assignee: oldAssignee,
        to_assignee: new_assignee_email,
      });

      return Response.json({ success: true, message: 'Step reassigned' });
    }

    // ── ACTION: send_reminder ────────────────────────────────────────────────
    if (action === 'send_reminder') {
      const { step_instance_id, message } = body;
      if (!step_instance_id) return Response.json({ error: 'step_instance_id required' }, { status: 400 });

      const stepInstances = await base44.asServiceRole.entities.FMSStepInstance.filter({ id: step_instance_id });
      const stepInst = stepInstances[0];
      if (!stepInst) return Response.json({ error: 'Step instance not found' }, { status: 404 });

      const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
      const instance = instances[0];

      await base44.asServiceRole.entities.FMSEscalationLog.create({
        instance_id: stepInst.instance_id,
        step_instance_id,
        step_name: stepInst.step_name,
        process_name: instance?.process_name || '',
        action_type: 'reminder',
        performed_by: user.email,
        target_email: stepInst.assignee_email,
        message: message || `Reminder: Please complete step "${stepInst.step_name}" before deadline.`,
        performed_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.FMSStepInstance.update(step_instance_id, {
        reminder_sent_at: new Date().toISOString(),
      });

      // Also send an email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: stepInst.assignee_email,
          subject: `Reminder: Action Required — ${stepInst.step_name}`,
          body: `Hello,\n\nThis is a reminder that you have a pending task:\n\nProcess: ${instance?.process_name || ''}\nStep: ${stepInst.step_name}\nDeadline: ${stepInst.deadline ? new Date(stepInst.deadline).toLocaleString('en-IN') : 'N/A'}\n\n${message || 'Please complete this task as soon as possible.'}\n\n— Process Control Team`,
        });
      } catch (_) { /* email failure is non-blocking */ }

      return Response.json({ success: true, message: 'Reminder sent' });
    }

    // ── ACTION: cancel_instance ──────────────────────────────────────────────
    if (action === 'cancel_instance') {
      const { instance_id, reason } = body;
      if (!instance_id) return Response.json({ error: 'instance_id required' }, { status: 400 });

      await base44.asServiceRole.entities.FMSProcessInstance.update(instance_id, {
        status: 'cancelled',
        notes: reason || 'Cancelled by user',
      });

      // Cancel all active steps
      const activeSteps = await base44.asServiceRole.entities.FMSStepInstance.filter({ instance_id, status: 'active' });
      for (const s of activeSteps) {
        await base44.asServiceRole.entities.FMSStepInstance.update(s.id, { status: 'skipped' });
      }

      return Response.json({ success: true, message: 'Instance cancelled' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});