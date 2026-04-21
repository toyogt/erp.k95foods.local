import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Voice-to-Task API for Apple Shortcuts
 * 
 * Accepts transcribed voice text, uses AI to extract task details,
 * and creates a DirectorTask automatically.
 * 
 * Payload: { voice_text: "Ask Ramesh to prepare the quarterly report by 25th April" }
 * 
 * The AI will extract:
 * - task_name, task_details, assigned_to (name match from user list)
 * - end_date (DD/MM/YYYY), is_important
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { voice_text } = await req.json();
    if (!voice_text || !voice_text.trim()) {
      return Response.json({ error: 'Missing voice_text' }, { status: 400 });
    }

    // Get all users for name matching
    const allUsers = await base44.entities.User.list();
    const userListStr = allUsers
      .filter(u => u.email)
      .map(u => `${u.full_name || ''} (${u.email}) [${u.role || 'user'}]`)
      .join('\n');

    // Get EAs for this director
    const eaMappings = await base44.entities.EADirectorMapping.filter({
      director_email: user.email,
      is_active: true,
    });
    const eaEmails = eaMappings.map(m => m.ea_email);

    // Today's date for context
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // Use AI to parse the voice text
    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a task extraction assistant for a Director in a company.
The Director just spoke this voice command to create a task:

"${voice_text}"

Today's date is: ${todayStr}

Here is the list of people in the company:
${userListStr}

Extract the following from the voice command:
1. task_name: A clear, concise title for the task
2. task_details: Any additional details mentioned (if none, leave empty)
3. assigned_to_email: Match the person's name mentioned to the closest user from the list above. If no specific person mentioned, leave empty.
4. end_date: The deadline in DD/MM/YYYY format. If "today" → use ${todayStr}. If "tomorrow" → calculate. If "next week" → add 7 days. If a specific date mentioned like "25th April" → convert to DD/MM/YYYY. If no date mentioned, default to 3 days from today.
5. end_time: Time if mentioned (HH:MM 24h format), otherwise empty
6. is_important: true if the voice mentions words like "urgent", "important", "critical", "ASAP", "priority", otherwise false

IMPORTANT: For assigned_to_email, you MUST pick from the user list above. Try to match by first name, last name, or nickname. If you can't find a match, leave it empty.`,
      response_json_schema: {
        type: 'object',
        properties: {
          task_name: { type: 'string' },
          task_details: { type: 'string' },
          assigned_to_email: { type: 'string' },
          end_date: { type: 'string' },
          end_time: { type: 'string' },
          is_important: { type: 'boolean' },
        },
      },
    });

    if (!aiResult.task_name) {
      return Response.json({
        success: false,
        error: 'Could not understand the voice command. Please try again with a clearer instruction.',
      }, { status: 400 });
    }

    // Validate assigned_to_email exists
    let assignee = null;
    if (aiResult.assigned_to_email) {
      assignee = allUsers.find(u => u.email === aiResult.assigned_to_email);
    }

    if (!assignee) {
      // If AI couldn't match, return what we parsed so they can fix
      return Response.json({
        success: false,
        error: `Could not find the person to assign this task to. Parsed: "${aiResult.assigned_to_email || 'no name detected'}"`,
        parsed: aiResult,
      }, { status: 400 });
    }

    // Generate task number
    const existing = await base44.entities.DirectorTask.list('-created_date', 1);
    const lastNum = existing.length > 0 ? parseInt((existing[0].task_number || 'DT-0000').replace('DT-', ''), 10) : 0;
    const taskNumber = `DT-${String(lastNum + 1).padStart(4, '0')}`;

    // Create the task
    const task = await base44.entities.DirectorTask.create({
      task_number: taskNumber,
      task_name: aiResult.task_name,
      task_details: aiResult.task_details || '',
      assigned_to_email: assignee.email,
      assigned_to_name: assignee.full_name || assignee.email,
      assigned_by_email: user.email,
      assigned_by_name: user.full_name,
      director_email: user.email,
      director_name: user.full_name,
      is_important: aiResult.is_important || false,
      start_date: '',
      start_time: '',
      end_date: aiResult.end_date || todayStr,
      end_time: aiResult.end_time || '',
      notification_time: '16:00',
      status: 'open',
      overdue_notified: false,
      ea_emails: eaEmails,
    });

    // Audit log
    await base44.entities.DirectorTaskLog.create({
      task_id: task.id,
      task_number: taskNumber,
      action: 'created',
      performed_by_email: user.email,
      performed_by_name: user.full_name,
      details: `Task created via voice command: "${voice_text}"`,
      timestamp: new Date().toISOString(),
    });

    // Send Telegram notification to assignee if they have chat ID
    const assigneeRecord = allUsers.find(u => u.email === assignee.email);
    if (assigneeRecord?.telegram_chat_id) {
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (token) {
        const msg = `📋 <b>New Task Assigned</b>\n\n` +
          `<b>Task:</b> ${aiResult.task_name} (${taskNumber})\n` +
          `<b>From:</b> ${user.full_name}\n` +
          `<b>Deadline:</b> ${aiResult.end_date}${aiResult.end_time ? ' ' + aiResult.end_time : ''}\n` +
          (aiResult.is_important ? `\n⚠️ <b>IMPORTANT</b>` : '') +
          (aiResult.task_details ? `\n\n${aiResult.task_details}` : '');

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: assigneeRecord.telegram_chat_id,
            text: msg,
            parse_mode: 'HTML',
          }),
        });
      }
    }

    return Response.json({
      success: true,
      task_number: taskNumber,
      task_name: aiResult.task_name,
      assigned_to: assignee.full_name || assignee.email,
      end_date: aiResult.end_date,
      is_important: aiResult.is_important,
      message: `Task ${taskNumber} created: "${aiResult.task_name}" assigned to ${assignee.full_name || assignee.email}, due ${aiResult.end_date}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});