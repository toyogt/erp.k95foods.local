import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    if (action === 'start') {
      const { process_id, title, trigger_source, trigger_data } = body;
      if (!process_id) return Response.json({ error: 'process_id is required' }, { status: 400 });

      const processes = await base44.asServiceRole.entities.Process.filter({ id: process_id });
      const process = processes[0];
      if (!process) return Response.json({ error: 'Process not found' }, { status: 404 });

      const steps = await base44.asServiceRole.entities.ProcessStep.filter({ process_id });
      steps.sort((a, b) => a.step_number - b.step_number);

      const now = new Date();
      const instance = await base44.asServiceRole.entities.ProcessInstance.create({
        process_id,
        process_name: process.name,
        title: title || `${process.name} — ${now.toLocaleDateString('en-IN')}`,
        status: 'active',
        trigger_type: 'auto',
        trigger_source: trigger_source || process.trigger_source || 'FactoryFlow',
        trigger_data: trigger_data || {},
        current_step_number: 1,
        started_at: now.toISOString(),
      });

      let prevCompletedAt = now;
      for (const step of steps) {
        const dueAt = calculateDueDate(prevCompletedAt, step);
        const isFirst = step.step_number === 1;
        await base44.asServiceRole.entities.StepInstance.create({
          process_instance_id: instance.id,
          process_id,
          step_id: step.id,
          step_number: step.step_number,
          step_name: step.name,
          assignee_email: step.assignee_email,
          assignee_name: step.assignee_name,
          status: isFirst ? 'active' : 'pending',
          due_at: dueAt.toISOString(),
          started_at: isFirst ? now.toISOString() : null,
          completion_type: step.completion_type,
        });
        prevCompletedAt = dueAt;
      }

      return Response.json({
        success: true,
        instance_id: instance.id,
        message: `Process "${process.name}" started`,
      });

    } else if (action === 'complete_step') {
      const { process_instance_id, step_number, completion_data, remarks } = body;
      if (!process_instance_id || step_number === undefined) {
        return Response.json({ error: 'process_instance_id and step_number are required' }, { status: 400 });
      }

      const stepInstances = await base44.asServiceRole.entities.StepInstance.filter({
        process_instance_id,
        step_number,
        status: 'active',
      });
      const stepInst = stepInstances[0];
      if (!stepInst) return Response.json({ error: 'Active step instance not found' }, { status: 404 });

      const now = new Date();
      const isLate = now > new Date(stepInst.due_at);
      const delayMins = isLate ? Math.floor((now - new Date(stepInst.due_at)) / 60000) : 0;

      await base44.asServiceRole.entities.StepInstance.update(stepInst.id, {
        status: 'completed',
        completed_at: now.toISOString(),
        is_delayed: isLate,
        delay_minutes: delayMins,
        completion_data: completion_data || {},
        remarks: remarks || 'Auto-completed',
      });

      const allSteps = await base44.asServiceRole.entities.StepInstance.filter({ process_instance_id });
      const nextStep = allSteps.find(s => s.step_number === step_number + 1);

      if (nextStep) {
        const templateSteps = await base44.asServiceRole.entities.ProcessStep.filter({
          process_id: stepInst.process_id,
          step_number: nextStep.step_number,
        });
        const templateStep = templateSteps[0];
        const newDue = templateStep
          ? calculateDueDate(now, templateStep)
          : new Date(now.getTime() + 2 * 60 * 60 * 1000);

        await base44.asServiceRole.entities.StepInstance.update(nextStep.id, {
          status: 'active',
          started_at: now.toISOString(),
          due_at: newDue.toISOString(),
        });
        await base44.asServiceRole.entities.ProcessInstance.update(process_instance_id, {
          current_step_number: nextStep.step_number,
        });

        return Response.json({
          success: true,
          message: `Step ${step_number} completed. Step ${nextStep.step_number} is now active.`,
        });
      } else {
        await base44.asServiceRole.entities.ProcessInstance.update(process_instance_id, {
          status: 'completed',
          completed_at: now.toISOString(),
        });
        return Response.json({ success: true, message: 'All steps completed. Process instance closed.' });
      }

    } else {
      return Response.json({ error: 'Invalid action. Use "start" or "complete_step"' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateDueDate(fromDate, step) {
  const from = new Date(fromDate);
  switch (step.tat_type) {
    case 'fixed_hours': return new Date(from.getTime() + (step.tat_hours || 1) * 60 * 60 * 1000);
    case 'end_of_day': {
      const [h, m] = (step.tat_eod_time || '18:00').split(':').map(Number);
      const eod = new Date(from); eod.setHours(h, m, 0, 0);
      if (eod <= from) eod.setDate(eod.getDate() + 1);
      return eod;
    }
    case 'fixed_time': {
      const [h, m] = (step.tat_fixed_time || '17:00').split(':').map(Number);
      const ft = new Date(from); ft.setHours(h, m, 0, 0);
      if (ft <= from) ft.setDate(ft.getDate() + 1);
      return ft;
    }
    case 'business_days': {
      const days = step.tat_business_days || 1;
      let d = new Date(from); let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      return d;
    }
    default: return new Date(from.getTime() + 2 * 60 * 60 * 1000);
  }
}