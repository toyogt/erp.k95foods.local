import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Scheduled automation: Check for overdue important director tasks
 * and send Telegram notifications to the Director + EAs.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const openTasks = await base44.asServiceRole.entities.DirectorTask.filter({
      status: 'open',
      is_important: true,
      overdue_notified: false,
    });

    const now = new Date();
    const notified = [];
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!token) {
      return Response.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }

    // Pre-load all users for chat ID lookup
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = {};
    allUsers.forEach(u => { if (u.email) userMap[u.email] = u; });

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

      if (now < endDate) continue;

      // Task is overdue — collect recipient emails
      const recipientEmails = [];
      if (task.director_email) recipientEmails.push(task.director_email);
      if (task.ea_emails?.length > 0) {
        task.ea_emails.forEach(e => {
          if (e && !recipientEmails.includes(e)) recipientEmails.push(e);
        });
      }

      // Build Telegram message
      const text = `⚠️ <b>OVERDUE: Important Task</b>\n\n` +
        `<b>Task:</b> ${task.task_name} (${task.task_number})\n` +
        `<b>Assigned To:</b> ${task.assigned_to_name || task.assigned_to_email}\n` +
        `<b>Deadline:</b> ${task.end_date} ${task.end_time || ''}\n` +
        `<b>Director:</b> ${task.director_name || task.director_email}\n` +
        (task.task_details ? `\n<b>Details:</b> ${task.task_details.substring(0, 200)}` : '') +
        `\n\n<i>K95 ERP Task Management</i>`;

      const sentTo = [];
      for (const email of recipientEmails) {
        const userRecord = userMap[email];
        const chatId = userRecord?.telegram_chat_id;
        if (!chatId) continue;

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
        const data = await res.json();
        if (data.ok) sentTo.push(email);
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
        details: `Telegram notification sent to: ${sentTo.length > 0 ? sentTo.join(', ') : 'No users with Telegram configured'}`,
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