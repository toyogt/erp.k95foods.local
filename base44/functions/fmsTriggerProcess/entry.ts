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

  return new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

// Complete a step and activate the next one
async function completeStepAndAdvance(base44, stepInst, completedBy, completionNote, now) {
  await base44.asServiceRole.entities.FMSStepInstance.update(stepInst.id, {
    status: 'completed',
    completed_at: now,
    completed_by: completedBy,
    completion_note: completionNote || '',
  });

  const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
  const instance = instances[0];
  if (!instance) return { process_completed: false };

  const allSteps = await base44.asServiceRole.entities.FMSProcessStep.filter({ process_id: instance.process_id });
  allSteps.sort((a, b) => a.step_order - b.step_order);
  const nextStepTemplate = allSteps.find(s => s.step_order === stepInst.step_order + 1);

  if (!nextStepTemplate) {
    await base44.asServiceRole.entities.FMSProcessInstance.update(instance.id, {
      status: 'completed',
      completed_at: now,
      current_step_order: stepInst.step_order,
    });
    return { process_completed: true };
  }

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

  return { process_completed: false };
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

      const processes = await base44.asServiceRole.entities.FMSProcess.filter({ id: process_id });
      const process = processes[0];
      if (!process) return Response.json({ error: 'Process not found' }, { status: 404 });

      const allSteps = await base44.asServiceRole.entities.FMSProcessStep.filter({ process_id });
      allSteps.sort((a, b) => a.step_order - b.step_order);
      if (allSteps.length === 0) return Response.json({ error: 'Process has no steps' }, { status: 400 });

      const now = new Date().toISOString();

      // ref_chain starts with the trigger_ref_id
      const refChain = trigger_ref_id ? [trigger_ref_id] : [];

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
        ref_chain: refChain,
        title: title || `${process.name} — ${new Date(now).toLocaleDateString('en-IN')}`,
      });

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
      const { step_instance_id, completion_note, completed_by_override, completed_ref_id } = body;
      if (!step_instance_id) return Response.json({ error: 'step_instance_id required' }, { status: 400 });

      const stepInstances = await base44.asServiceRole.entities.FMSStepInstance.filter({ id: step_instance_id });
      const stepInst = stepInstances[0];
      if (!stepInst) return Response.json({ error: 'Step instance not found' }, { status: 404 });
      if (stepInst.status !== 'active') return Response.json({ error: 'Step is not active' }, { status: 400 });

      const now = new Date().toISOString();
      const completedBy = completed_by_override || user.email;

      // If this step completion produces a new record (e.g. PO created), 
      // add its ID to the instance's ref_chain for future step matching
      if (completed_ref_id) {
        const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
        const inst = instances[0];
        if (inst) {
          const chain = Array.isArray(inst.ref_chain) ? inst.ref_chain : [];
          if (!chain.includes(completed_ref_id)) {
            await base44.asServiceRole.entities.FMSProcessInstance.update(inst.id, {
              ref_chain: [...chain, completed_ref_id],
            });
          }
        }
      }

      const result = await completeStepAndAdvance(base44, stepInst, completedBy, completion_note, now);
      return Response.json({ success: true, message: result.process_completed ? 'Process completed' : 'Step completed, next step activated', ...result });
    }

    // ── ACTION: auto_complete (triggered internally from app events) ─────────
    //
    // HOW REF MATCHING WORKS:
    // When fireFMSEvent('purchase_order_created', poId) is called,
    // we look for instances where poId is in their ref_chain.
    // This means only the process instance that was linked to that specific
    // PO (because the PO's ID was added to ref_chain when the PO was created)
    // will have its step auto-completed.
    //
    // Flow example:
    //   1. Purchase Request #PR1 created → triggerFMSProcess() starts instance,
    //      trigger_ref_id = PR1, ref_chain = [PR1]
    //   2. Buyer opens PR1 and creates PO #PO1 → fires fireFMSEvent('purchase_order_created', 'PO1')
    //      BUT also calls completeStep with completed_ref_id = 'PO1'
    //      → ref_chain becomes [PR1, PO1]
    //   3. Next step auto-completes when fireFMSEvent('purchase_order_approved', 'PO1') fires
    //      → matches because PO1 is in ref_chain ✓
    //
    if (action === 'auto_complete') {
      const { auto_complete_event, trigger_ref_id } = body;
      if (!auto_complete_event) return Response.json({ error: 'auto_complete_event required' }, { status: 400 });

      const now = new Date().toISOString();

      // Get all active step instances with completion_mode = auto
      const allActive = await base44.asServiceRole.entities.FMSStepInstance.filter({ status: 'active' });
      const autoSteps = allActive.filter(s => s.completion_mode === 'auto');

      const results = [];

      for (const stepInst of autoSteps) {
        if (!stepInst.step_id) continue;

        // Check step template has matching event
        const stepTemplates = await base44.asServiceRole.entities.FMSProcessStep.filter({ id: stepInst.step_id });
        const stepTemplate = stepTemplates[0];
        if (!stepTemplate || stepTemplate.auto_complete_event !== auto_complete_event) continue;

        // If trigger_ref_id provided, match against the instance's ref_chain
        if (trigger_ref_id) {
          const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: stepInst.instance_id });
          const inst = instances[0];
          if (!inst) continue;

          const chain = Array.isArray(inst.ref_chain) ? inst.ref_chain : [inst.trigger_ref_id].filter(Boolean);

          // Only proceed if this ref is in the chain for this instance
          if (!chain.includes(trigger_ref_id)) continue;
        }

        // Complete this step and advance
        await completeStepAndAdvance(
          base44,
          stepInst,
          'system (auto)',
          `Auto-completed by event: ${auto_complete_event}`,
          now
        );
        results.push(stepInst.id);
      }

      return Response.json({ success: true, auto_completed: results.length, step_ids: results });
    }

    // ── ACTION: link_ref (add a new record ID to an instance's ref_chain) ────
    // Call this when a step produces a new record that future steps will reference.
    // e.g. when PO is created against PR: link_ref(instance_id, poId)
    if (action === 'link_ref') {
      const { instance_id, ref_id } = body;
      if (!instance_id || !ref_id) return Response.json({ error: 'instance_id and ref_id required' }, { status: 400 });

      const instances = await base44.asServiceRole.entities.FMSProcessInstance.filter({ id: instance_id });
      const inst = instances[0];
      if (!inst) return Response.json({ error: 'Instance not found' }, { status: 404 });

      const chain = Array.isArray(inst.ref_chain) ? inst.ref_chain : [inst.trigger_ref_id].filter(Boolean);
      if (!chain.includes(ref_id)) {
        await base44.asServiceRole.entities.FMSProcessInstance.update(instance_id, {
          ref_chain: [...chain, ref_id],
        });
      }

      return Response.json({ success: true, message: 'Ref linked', ref_chain: [...chain, ref_id] });
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