import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Scheduled automation: Check for overdue important director tasks
 * and send email notifications to the Director + EAs.
 * Runs daily — checks tasks whose end_date + notification_time has passed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This is a scheduled task — use service role
    const openTasks = await base44.asServiceRole.entities.DirectorTask.filter({
      status: 'open',
      is_important: true,
      overdue_notified: false,
    });

    const now = new Date();
    const notified = [];

    for (const task of openTasks) {
      if (!task.end_date) continue;

      // Parse DD/MM/YYYY
      const parts = task.end_date.split('/');
      if (parts.length !== 3) continue;
      const [dd, mm, yyyy] = parts.map(Number);
      const endDate = new Date(yyyy, mm - 1, dd);

      // Parse notification time (default 16:00)
      const timeStr = task.notification_time || task.end_time || '16:00';
      const [h, m] = timeStr.split(':').map(Number);
      endDate.setHours(h || 16, m || 0, 0, 0);

      // Check if past the notification deadline
      if (now < endDate) continue;

      // Task is overdue — send notifications
      const recipients = [];
      
      // Director
      if (task.director_email) {
        recipients.push(task.director_email);
      }

      // EAs
      if (task.ea_emails?.length > 0) {
        task.ea_emails.forEach(e => {
          if (e && !recipients.includes(e)) recipients.push(e);
        });
      }

      const subject = `⚠️ OVERDUE: Important Task "${task.task_name}" (${task.task_number})`;
      const body = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #FEF2F2; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px;">
    <h2 style="color: #DC2626; margin: 0 0 8px 0;">⚠️ Important Task Overdue</h2>
    <p style="color: #7F1D1D; margin: 0;">This task has not been completed by the deadline.</p>
  </div>
  
  <div style="padding: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #64748B; width: 120px;">Task Number</td><td style="font-weight: 600;">${task.task_number}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748B;">Task Name</td><td style="font-weight: 600;">${task.task_name}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748B;">Assigned To</td><td>${task.assigned_to_name || task.assigned_to_email}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748B;">Deadline</td><td style="color: #DC2626; font-weight: 600;">${task.end_date} ${task.end_time || ''}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748B;">Director</td><td>${task.director_name || task.director_email}</td></tr>
    </table>
    ${task.task_details ? `<div style="margin-top: 12px; background: #F8FAFC; padding: 12px; border-radius: 6px;"><p style="color: #64748B; font-size: 12px; margin: 0 0 4px;">Details:</p><p style="margin: 0; color: #334155;">${task.task_details}</p></div>` : ''}
  </div>
  
  <p style="color: #94A3B8; font-size: 12px;">This is an automated notification from K95 ERP Task Management.</p>
</div>`;

      for (const to of recipients) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          body,
          from_name: 'K95 Task Manager',
        });
      }

      // Mark as notified
      await base44.asServiceRole.entities.DirectorTask.update(task.id, {
        overdue_notified: true,
      });

      // Log
      await base44.asServiceRole.entities.DirectorTaskLog.create({
        task_id: task.id,
        task_number: task.task_number,
        action: 'overdue_notification_sent',
        performed_by_email: 'system',
        performed_by_name: 'System',
        details: `Overdue notification sent to: ${recipients.join(', ')}`,
        timestamp: new Date().toISOString(),
      });

      notified.push(task.task_number);
    }

    return Response.json({
      success: true,
      checked: openTasks.length,
      notified: notified.length,
      task_numbers: notified,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});