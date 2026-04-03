import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active templates
    const templates = await base44.asServiceRole.entities.ScheduledTaskTemplate.filter({ is_active: true }, '-created_date', 500);
    const groups = await base44.asServiceRole.entities.ScheduledTaskGroup.filter({ is_active: true }, '-created_date', 200);
    const groupMap = {};
    groups.forEach(g => { groupMap[g.group_id] = g; });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay(); // 0=Sun
    const dayOfMonth = now.getDate();

    let created = 0;
    let notified = 0;

    for (const tmpl of templates) {
      // Check if this template should fire today
      let shouldFire = false;

      if (tmpl.schedule_type === 'daily') {
        shouldFire = true;
      } else if (tmpl.schedule_type === 'weekly') {
        const days = tmpl.schedule_days_of_week || [];
        shouldFire = days.includes(dayOfWeek);
      } else if (tmpl.schedule_type === 'monthly') {
        shouldFire = (tmpl.schedule_day_of_month === dayOfMonth);
      }

      if (!shouldFire) continue;

      // Check if already generated today (prevent duplicates)
      if (tmpl.last_generated_at) {
        const lastGen = tmpl.last_generated_at.slice(0, 10);
        if (lastGen === todayStr) continue;
      }

      // Calculate due_at
      const dueHours = tmpl.due_hours || 24;
      const dueAt = new Date(now.getTime() + dueHours * 60 * 60 * 1000);

      const group = groupMap[tmpl.group_id];
      const instanceId = `STI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // Create task instance
      await base44.asServiceRole.entities.ScheduledTaskInstance.create({
        instance_id: instanceId,
        template_id: tmpl.template_id,
        task_name: tmpl.task_name,
        description: tmpl.description || '',
        group_id: tmpl.group_id,
        group_name: tmpl.group_name || group?.group_name || '',
        assignee_email: tmpl.assignee_email,
        assignee_name: tmpl.assignee_name || '',
        coordinator_email: group?.coordinator_email || '',
        due_at: dueAt.toISOString(),
        priority: tmpl.priority || 'MEDIUM',
        status: 'PENDING',
      });
      created++;

      // Update last_generated_at
      await base44.asServiceRole.entities.ScheduledTaskTemplate.update(tmpl.id, {
        last_generated_at: now.toISOString(),
      });

      // Send email notification to assignee
      const dueDateFormatted = `${String(dueAt.getDate()).padStart(2, '0')}/${String(dueAt.getMonth() + 1).padStart(2, '0')}/${dueAt.getFullYear()} ${String(dueAt.getHours()).padStart(2, '0')}:${String(dueAt.getMinutes()).padStart(2, '0')}`;
      
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: tmpl.assignee_email,
        subject: `[Task Due] ${tmpl.task_name}`,
        body: `<div style="font-family:sans-serif;max-width:500px">
          <h2 style="color:#1e293b">${tmpl.task_name}</h2>
          <p style="color:#64748b">${tmpl.description || 'No description'}</p>
          <table style="margin:16px 0;font-size:14px">
            <tr><td style="color:#94a3b8;padding-right:12px">Group:</td><td style="color:#1e293b;font-weight:600">${tmpl.group_name || '-'}</td></tr>
            <tr><td style="color:#94a3b8;padding-right:12px">Due:</td><td style="color:#dc2626;font-weight:600">${dueDateFormatted}</td></tr>
            <tr><td style="color:#94a3b8;padding-right:12px">Priority:</td><td style="color:#1e293b">${tmpl.priority || 'MEDIUM'}</td></tr>
          </table>
          <p style="color:#64748b;font-size:13px">Open K95 ERP → Process Flow → My Tasks to complete this task.</p>
        </div>`,
      });
      notified++;
    }

    return Response.json({ success: true, created, notified, checked: templates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});