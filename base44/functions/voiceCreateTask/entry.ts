import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Voice-to-Task API for Apple Shortcuts
 * 
 * Authentication: API key via header "x-api-key" (never expires)
 * Also requires "x-director-email" header to identify the director.
 * 
 * Accepts EITHER:
 *  - Audio file via multipart form-data (field name "audio") — AI transcribes + parses
 *  - JSON body with { voice_text: "..." } — AI parses text directly
 * 
 * The Shortcut flow: Record Audio → Send file to this endpoint → AI does everything
 */
Deno.serve(async (req) => {
  try {
    // API key authentication (no expiring tokens)
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('VOICE_TASK_API_KEY');
    if (!apiKey || apiKey !== expectedKey) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const directorEmail = req.headers.get('x-director-email');
    if (!directorEmail) {
      return Response.json({ error: 'Missing x-director-email header' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Look up the director from users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const director = allUsers.find(u => u.email === directorEmail);
    if (!director) {
      return Response.json({ error: `Director not found: ${directorEmail}` }, { status: 400 });
    }

    let voiceText = null;
    let audioFileUrl = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Audio file upload from Shortcut
      const formData = await req.formData();
      const audioFile = formData.get('audio');
      if (!audioFile) {
        return Response.json({ error: 'Missing audio file. Send as form field named "audio".' }, { status: 400 });
      }
      // Upload audio to Base44 storage
      const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: audioFile });
      audioFileUrl = uploadResult.file_url;
    } else {
      // JSON fallback — text already transcribed
      const body = await req.json();
      voiceText = body.voice_text;
      if (!voiceText || !voiceText.trim()) {
        return Response.json({ error: 'Missing voice_text or audio file' }, { status: 400 });
      }
    }

    // Build user list string for AI prompt
    const userListStr = allUsers
      .filter(u => u.email)
      .map(u => `${u.full_name || ''} (${u.email}) [${u.role || 'user'}]`)
      .join('\n');

    // Get EAs for this director
    const eaMappings = await base44.asServiceRole.entities.EADirectorMapping.filter({
      director_email: director.email,
      is_active: true,
    });
    const eaEmails = eaMappings.map(m => m.ea_email);

    // Today's date for context
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // Build prompt — same for both audio and text
    const basePrompt = `You are a task extraction assistant for a Director in a company.
Today's date is: ${todayStr}

Here is the list of people in the company:
${userListStr}

${audioFileUrl 
  ? 'The Director has recorded an audio voice command to create a task. Listen to the attached audio file carefully and extract the task details from it.'
  : `The Director spoke this voice command to create a task:\n\n"${voiceText}"`}

Extract the following:
1. task_name: A clear, concise title for the task
2. task_details: Any additional details mentioned (if none, leave empty)
3. assigned_to_email: Match the person's name mentioned to the closest user from the list above. If no specific person mentioned, leave empty.
4. end_date: The deadline in DD/MM/YYYY format. If "today" → use ${todayStr}. If "tomorrow" → calculate. If "next week" → add 7 days. If a specific date mentioned like "25th April" → convert to DD/MM/YYYY using year ${now.getFullYear()}. If no date mentioned, default to 3 days from today.
5. end_time: Time if mentioned (HH:MM 24h format), otherwise empty
6. is_important: true if the voice mentions words like "urgent", "important", "critical", "ASAP", "priority", otherwise false
7. transcription: The full text of what was said (transcribe the audio exactly if audio was provided, or repeat voice_text if text)

IMPORTANT: For assigned_to_email, you MUST pick from the user list above. Try to match by first name, last name, or nickname. If you can't find a match, leave it empty.`;

    const llmParams = {
      prompt: basePrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          task_name: { type: 'string' },
          task_details: { type: 'string' },
          assigned_to_email: { type: 'string' },
          end_date: { type: 'string' },
          end_time: { type: 'string' },
          is_important: { type: 'boolean' },
          transcription: { type: 'string' },
        },
      },
    };

    // If audio file, attach it for the AI to transcribe
    if (audioFileUrl) {
      llmParams.file_urls = [audioFileUrl];
    }

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM(llmParams);

    if (!aiResult.task_name) {
      return Response.json({
        success: false,
        error: 'Could not understand the voice command. Please try again with a clearer instruction.',
        transcription: aiResult.transcription || null,
      }, { status: 400 });
    }

    // Validate assigned_to_email exists
    let assignee = null;
    if (aiResult.assigned_to_email) {
      assignee = allUsers.find(u => u.email === aiResult.assigned_to_email);
    }

    if (!assignee) {
      return Response.json({
        success: false,
        error: `Could not find the person to assign this task to. Parsed: "${aiResult.assigned_to_email || 'no name detected'}"`,
        transcription: aiResult.transcription || null,
        parsed: aiResult,
      }, { status: 400 });
    }

    // Generate task number
    const existing = await base44.asServiceRole.entities.DirectorTask.list('-created_date', 1);
    const lastNum = existing.length > 0 ? parseInt((existing[0].task_number || 'DT-0000').replace('DT-', ''), 10) : 0;
    const taskNumber = `DT-${String(lastNum + 1).padStart(4, '0')}`;

    // Create the task
    const task = await base44.asServiceRole.entities.DirectorTask.create({
      task_number: taskNumber,
      task_name: aiResult.task_name,
      task_details: aiResult.task_details || '',
      assigned_to_email: assignee.email,
      assigned_to_name: assignee.full_name || assignee.email,
      assigned_by_email: director.email,
      assigned_by_name: director.full_name,
      director_email: director.email,
      director_name: director.full_name,
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
    const sourceText = aiResult.transcription || voiceText || '(audio)';
    await base44.asServiceRole.entities.DirectorTaskLog.create({
      task_id: task.id,
      task_number: taskNumber,
      action: 'created',
      performed_by_email: director.email,
      performed_by_name: director.full_name,
      details: `Task created via voice command: "${sourceText}"`,
      timestamp: new Date().toISOString(),
    });

    // Send Telegram notification to assignee
    const assigneeRecord = allUsers.find(u => u.email === assignee.email);
    if (assigneeRecord?.telegram_chat_id) {
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (token) {
        const msg = `📋 <b>New Task Assigned</b>\n\n` +
          `<b>Task:</b> ${aiResult.task_name} (${taskNumber})\n` +
          `<b>From:</b> ${director.full_name}\n` +
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
      transcription: aiResult.transcription || voiceText,
      message: `Task ${taskNumber} created: "${aiResult.task_name}" assigned to ${assignee.full_name || assignee.email}, due ${aiResult.end_date}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});