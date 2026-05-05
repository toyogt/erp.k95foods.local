import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Voice-to-Task API for Apple Shortcuts
 *
 * Authentication: Custom API key via "x-api-key" header (VOICE_TASK_API_KEY secret)
 * Also requires "x-director-email" header to identify the director.
 *
 * Accepts:
 *  - Audio file via multipart form-data (field "audio") — Whisper transcribes, then AI parses
 *  - JSON body with { voice_text: "..." } — AI parses text directly
 *
 * Always creates standalone DirectorTask(s) — never creates projects.
 */

// ── Helper: generate next task number ────────────────────────────────────────
async function getNextTaskNumber(base44) {
  const existing = await base44.asServiceRole.entities.DirectorTask.list('-created_date', 1);
  const lastNum = existing.length > 0
    ? parseInt((existing[0].task_number || 'DT-0000').replace('DT-', ''), 10)
    : 0;
  return lastNum;
}

// ── Helper: send Telegram message ────────────────────────────────────────────
async function sendTelegram(token, chatId, html) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
  });
}

Deno.serve(async (req) => {
  try {
    // ── Custom API key auth ───────────────────────────────────────────────────
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('VOICE_TASK_API_KEY');
    if (!apiKey || apiKey !== expectedKey) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const directorEmail = req.headers.get('x-director-email');
    if (!directorEmail) {
      return Response.json({ error: 'Missing x-director-email header' }, { status: 400 });
    }

    // ── Parse request body ────────────────────────────────────────────────────
    let voiceText = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const audioFile = formData.get('audio');
      if (!audioFile) {
        return Response.json({ error: 'Missing audio file. Send as form field named "audio".' }, { status: 400 });
      }

      // ── Whisper transcription ─────────────────────────────────────────────
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
      }

      const whisperForm = new FormData();
      whisperForm.append('file', audioFile, audioFile.name || 'audio.m4a');
      whisperForm.append('model', 'whisper-1');
      whisperForm.append('language', 'en');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        body: whisperForm,
      });

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        console.error('[voiceCreateTask] Whisper error:', err);
        return Response.json({ error: 'Audio transcription failed: ' + err }, { status: 500 });
      }

      const whisperData = await whisperRes.json();
      voiceText = whisperData.text;

      if (!voiceText || !voiceText.trim()) {
        return Response.json({ error: 'Could not transcribe audio. Please speak clearly and try again.' }, { status: 400 });
      }

      console.log('[voiceCreateTask] Whisper transcription:', voiceText);

    } else {
      let rawBody = '';
      try { rawBody = await req.text(); } catch (_e) { /* empty */ }
      if (rawBody) {
        try { voiceText = JSON.parse(rawBody).voice_text; } catch (_e) { /* not JSON */ }
      }
      if (!voiceText || !voiceText.trim()) {
        return Response.json({ error: 'Missing voice_text or audio file' }, { status: 400 });
      }
    }

    // ── SDK + user data ───────────────────────────────────────────────────────
    const base44 = createClientFromRequest(req);

    const allUsers = await base44.asServiceRole.entities.User.list();
    const director = allUsers.find(u => u.email === directorEmail);
    if (!director) {
      return Response.json({ error: `Director not found: ${directorEmail}` }, { status: 400 });
    }

    const eaMappings = await base44.asServiceRole.entities.EADirectorMapping.filter({
      director_email: director.email,
      is_active: true,
    });

    if (!eaMappings || eaMappings.length === 0) {
      return Response.json({
        error: `No EA mapped for director ${director.full_name} (${director.email}). Set up EA-Director mapping first.`,
      }, { status: 400 });
    }

    const eaMapping = eaMappings[0];
    const eaUser = allUsers.find(u => u.email === eaMapping.ea_email);
    const eaEmails = eaMappings.map(m => m.ea_email);
    const assignee = eaUser || { email: eaMapping.ea_email, full_name: eaMapping.ea_name || eaMapping.ea_email };

    // Today (IST)
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = `${String(ist.getDate()).padStart(2, '0')}/${String(ist.getMonth() + 1).padStart(2, '0')}/${ist.getFullYear()}`;

    // Default end date = 3 days from today (IST)
    const defaultEnd = new Date(ist.getTime() + 3 * 24 * 60 * 60 * 1000);
    const defaultEndStr = `${String(defaultEnd.getDate()).padStart(2, '0')}/${String(defaultEnd.getMonth() + 1).padStart(2, '0')}/${defaultEnd.getFullYear()}`;

    // ── AI extraction — always standalone task ────────────────────────────────
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a smart task extraction assistant for a Director in a company.
Today's date is: ${todayStr}
The Director's Executive Assistant email is: ${assignee.email}

The Director spoke this voice command:
"${voiceText}"

RULES:
1. Extract exactly ONE standalone task from this voice command.
2. Even if the command mentions multiple things, combine them into a single clear task with detailed task_details.
3. Do NOT create multiple tasks or projects. Always return exactly one task.
4. For end dates:
   - "today" → ${todayStr}
   - "tomorrow" → calculate from today
   - "next week" → add 7 days
   - A specific date like "25th April" → use year ${ist.getFullYear()}
   - If no deadline is mentioned at all, default to: ${defaultEndStr}
5. is_important: true if urgent/important/critical/ASAP/priority is mentioned.
6. All dates must be in DD/MM/YYYY format.
7. assigned_to_email must always be set to: ${assignee.email}`,
      response_json_schema: {
        type: 'object',
        properties: {
          task_name: { type: 'string' },
          task_details: { type: 'string' },
          end_date: { type: 'string' },
          end_time: { type: 'string' },
          is_important: { type: 'boolean' },
        },
        required: ['task_name'],
      },
    });

    if (!aiResult || !aiResult.task_name) {
      await base44.asServiceRole.entities.VoiceCommandLog.create({
        director_email: director.email,
        director_name: director.full_name,
        transcript: voiceText,
        input_mode: contentType.includes('multipart/form-data') ? 'audio' : 'text',
        action_type: 'failed',
        tasks_created: 0,
        task_numbers: [],
        ai_parsed_json: JSON.stringify(aiResult || {}),
        error_message: 'AI returned no task',
      });
      return Response.json({
        success: false,
        error: 'Could not understand the voice command. Please try again.',
        transcription: voiceText,
      }, { status: 400 });
    }

    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const isImportant = aiResult.is_important || false;

    // ── Create standalone task ────────────────────────────────────────────────
    const lastTaskNum = await getNextTaskNumber(base44);
    const taskNumber = `DT-${String(lastTaskNum + 1).padStart(4, '0')}`;

    const task = await base44.asServiceRole.entities.DirectorTask.create({
      task_number: taskNumber,
      task_name: aiResult.task_name,
      task_details: aiResult.task_details || '',
      task_type: 'single',
      assigned_to_email: assignee.email,
      assigned_to_name: assignee.full_name || assignee.email,
      assigned_by_email: director.email,
      assigned_by_name: director.full_name,
      director_email: director.email,
      director_name: director.full_name,
      is_important: isImportant,
      start_date: '',
      start_time: '',
      end_date: aiResult.end_date || defaultEndStr,
      end_time: aiResult.end_time || '',
      notification_time: '16:00',
      status: 'open',
      overdue_notified: false,
      ea_emails: eaEmails,
    });

    await base44.asServiceRole.entities.DirectorTaskLog.create({
      task_id: task.id,
      task_number: taskNumber,
      action: 'created',
      performed_by_email: director.email,
      performed_by_name: director.full_name,
      details: `Task created via voice command: "${voiceText}"`,
      timestamp: new Date().toISOString(),
    });

    if (eaUser?.telegram_chat_id && telegramToken) {
      const msg = `📋 <b>New Task Assigned</b>\n\n` +
        `<b>Task:</b> ${aiResult.task_name} (${taskNumber})\n` +
        `<b>From:</b> ${director.full_name}\n` +
        `<b>Deadline:</b> ${aiResult.end_date || defaultEndStr}${aiResult.end_time ? ' ' + aiResult.end_time : ''}` +
        (isImportant ? `\n\n⚠️ <b>IMPORTANT</b>` : '') +
        (aiResult.task_details ? `\n\n${aiResult.task_details}` : '');
      await sendTelegram(telegramToken, eaUser.telegram_chat_id, msg);
    }

    // Log creation
    await base44.asServiceRole.entities.VoiceCommandLog.create({
      director_email: director.email,
      director_name: director.full_name,
      transcript: voiceText,
      input_mode: contentType.includes('multipart/form-data') ? 'audio' : 'text',
      action_type: 'create_standalone_task',
      tasks_created: 1,
      task_numbers: [taskNumber],
      ai_parsed_json: JSON.stringify(aiResult),
    });

    return Response.json({
      success: true,
      action_type: 'create_standalone_task',
      task_number: taskNumber,
      task_name: aiResult.task_name,
      assigned_to: assignee.full_name || assignee.email,
      end_date: aiResult.end_date || defaultEndStr,
      is_important: isImportant,
      transcription: voiceText,
      message: `Task ${taskNumber} created: "${aiResult.task_name}" assigned to ${assignee.full_name || assignee.email}, due ${aiResult.end_date || defaultEndStr}`,
    });

  } catch (error) {
    console.error('[voiceCreateTask] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});