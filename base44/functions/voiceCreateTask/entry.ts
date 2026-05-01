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
 * Supports:
 *  - Single task creation
 *  - Multi-task sequences with automatic predecessor/dependency linking
 *  - Smart end date inference when only an overall deadline is mentioned
 */
Deno.serve(async (req) => {
  try {
    // ── Custom API key auth ──────────────────────────────────────
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('VOICE_TASK_API_KEY');
    if (!apiKey || apiKey !== expectedKey) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const directorEmail = req.headers.get('x-director-email');
    if (!directorEmail) {
      return Response.json({ error: 'Missing x-director-email header' }, { status: 400 });
    }

    // ── Parse request body ───────────────────────────────────────
    let voiceText = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const audioFile = formData.get('audio');
      if (!audioFile) {
        return Response.json({ error: 'Missing audio file. Send as form field named "audio".' }, { status: 400 });
      }

      // ── Whisper transcription ────────────────────────────────
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

    // ── SDK init ─────────────────────────────────────────────────
    const base44 = createClientFromRequest(req);

    const allUsers = await base44.asServiceRole.entities.User.list();
    const director = allUsers.find(u => u.email === directorEmail);
    if (!director) {
      return Response.json({ error: `Director not found: ${directorEmail}` }, { status: 400 });
    }

    // Get EA mapping for this director
    const eaMappings = await base44.asServiceRole.entities.EADirectorMapping.filter({
      director_email: director.email,
      is_active: true,
    });

    if (!eaMappings || eaMappings.length === 0) {
      return Response.json({
        error: `No EA mapped for director ${director.full_name} (${director.email}). Set up EA-Director mapping first.`
      }, { status: 400 });
    }

    const eaMapping = eaMappings[0];
    const eaUser = allUsers.find(u => u.email === eaMapping.ea_email);
    const eaEmails = eaMappings.map(m => m.ea_email);

    // Today (IST)
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = `${String(ist.getDate()).padStart(2, '0')}/${String(ist.getMonth() + 1).padStart(2, '0')}/${ist.getFullYear()}`;

    // Helper: add days to a DD/MM/YYYY date string
    function addDays(dateStr, days) {
      const parts = dateStr.split('/');
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      d.setDate(d.getDate() + days);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Helper: days between two DD/MM/YYYY date strings
    function daysBetween(startStr, endStr) {
      const toDate = (s) => {
        const p = s.split('/');
        return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
      };
      const diff = toDate(endStr) - toDate(startStr);
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    }

    // ── AI extraction — supports multi-task sequences ─────────────
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a task extraction assistant for a Director in a company.
Today's date is: ${todayStr} (DD/MM/YYYY format)

The Director spoke this voice command to create tasks for their Executive Assistant:

"${voiceText}"

Analyze this command and extract ALL tasks mentioned. Tasks may be sequential (one depends on another being completed first).

Rules for date extraction:
- "today" → ${todayStr}
- "tomorrow" → add 1 day to today
- "day after tomorrow" → add 2 days to today
- "this week" → Friday of current week
- "next week" → next Friday
- "in X days" → add X days to today
- Specific dates like "25th April" → use year ${ist.getFullYear()}
- If a task has an explicit date mentioned, use it
- If only an overall deadline is given and there are multiple tasks, distribute dates evenly between today and the final deadline
- If no date is mentioned at all, default the LAST task to 3 days from today, and space earlier tasks evenly before it

Return a JSON object with a "tasks" array. Each task has:
- task_name: clear, concise title
- task_details: additional details (empty string if none)
- end_date: deadline in DD/MM/YYYY format (REQUIRED for every task)
- end_time: time in HH:MM 24h format if mentioned, otherwise empty string
- is_important: true if urgent/important/critical/ASAP mentioned
- predecessor_index: index (0-based) of the task in this array that must be completed BEFORE this task can start. Use -1 if no dependency.

Example for "Negotiate CTO contract by Wednesday, then formally renew by Friday":
{
  "tasks": [
    { "task_name": "Negotiate CTO contract renewal", "task_details": "", "end_date": "DD/MM/YYYY", "end_time": "", "is_important": false, "predecessor_index": -1 },
    { "task_name": "Complete formal CTO contract renewal", "task_details": "", "end_date": "DD/MM/YYYY", "end_time": "", "is_important": false, "predecessor_index": 0 }
  ]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_name: { type: 'string' },
                task_details: { type: 'string' },
                end_date: { type: 'string' },
                end_time: { type: 'string' },
                is_important: { type: 'boolean' },
                predecessor_index: { type: 'number' },
              },
            },
          },
        },
      },
    });

    if (!aiResult || !aiResult.tasks || aiResult.tasks.length === 0) {
      return Response.json({
        success: false,
        error: 'Could not understand the voice command. Please try again.',
        transcription: voiceText,
      }, { status: 400 });
    }

    // ── Validate and fill missing end_dates ──────────────────────
    const tasks = aiResult.tasks;
    const lastTask = tasks[tasks.length - 1];
    if (!lastTask.end_date) {
      lastTask.end_date = addDays(todayStr, 3);
    }
    // Distribute dates evenly for tasks without explicit end_date
    const totalDays = daysBetween(todayStr, lastTask.end_date);
    const interval = tasks.length > 1 ? Math.floor(totalDays / tasks.length) : totalDays;
    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].end_date) {
        tasks[i].end_date = addDays(todayStr, interval * (i + 1));
      }
    }

    // ── Get last task number ─────────────────────────────────────
    const existing = await base44.asServiceRole.entities.DirectorTask.list('-created_date', 1);
    const lastNum = existing.length > 0
      ? parseInt((existing[0].task_number || 'DT-0000').replace('DT-', ''), 10)
      : 0;

    const assignee = eaUser || { email: eaMapping.ea_email, full_name: eaMapping.ea_name || eaMapping.ea_email };

    // ── Create tasks sequentially, linking predecessors ──────────
    const createdTaskIds = [];    // indexed parallel to tasks[]
    const createdTaskNumbers = [];
    const createdTaskRecords = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const taskNumber = `DT-${String(lastNum + i + 1).padStart(4, '0')}`;

      // Determine predecessor IDs and numbers
      const predecessorIds = [];
      const predecessorNumbers = [];
      if (t.predecessor_index !== undefined && t.predecessor_index >= 0 && createdTaskIds[t.predecessor_index]) {
        predecessorIds.push(createdTaskIds[t.predecessor_index]);
        predecessorNumbers.push(createdTaskNumbers[t.predecessor_index]);
      }

      const isBlocked = predecessorIds.length > 0;

      const taskRecord = await base44.asServiceRole.entities.DirectorTask.create({
        task_number: taskNumber,
        task_name: t.task_name,
        task_details: t.task_details || '',
        assigned_to_email: assignee.email,
        assigned_to_name: assignee.full_name || assignee.email,
        assigned_by_email: director.email,
        assigned_by_name: director.full_name,
        director_email: director.email,
        director_name: director.full_name,
        is_important: t.is_important || false,
        start_date: '',
        start_time: '',
        end_date: t.end_date,
        end_time: t.end_time || '',
        notification_time: '16:00',
        status: isBlocked ? 'blocked' : 'open',
        overdue_notified: false,
        ea_emails: eaEmails,
        predecessor_task_ids: predecessorIds,
        predecessor_task_numbers: predecessorNumbers,
      });

      createdTaskIds.push(taskRecord.id);
      createdTaskNumbers.push(taskNumber);
      createdTaskRecords.push({ taskRecord, taskNumber, t });

      // Audit log
      const predecessorNote = predecessorIds.length > 0
        ? ` Blocked by: ${predecessorNumbers.join(', ')}.`
        : '';
      await base44.asServiceRole.entities.DirectorTaskLog.create({
        task_id: taskRecord.id,
        task_number: taskNumber,
        action: 'created',
        performed_by_email: director.email,
        performed_by_name: director.full_name,
        details: `Task created via voice command: "${voiceText}".${predecessorNote}`,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Telegram notification to EA ──────────────────────────────
    if (eaUser?.telegram_chat_id) {
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (token) {
        const taskLines = createdTaskRecords.map(({ taskRecord, taskNumber, t }, idx) => {
          const blockedNote = taskRecord.status === 'blocked'
            ? ` (Blocked — awaiting ${createdTaskNumbers[tasks[idx].predecessor_index]})`
            : '';
          return `${idx + 1}. <b>${t.task_name}</b> (${taskNumber}) — Due: ${t.end_date}${t.end_time ? ' ' + t.end_time : ''}${blockedNote}`;
        }).join('\n');

        const hasImportant = createdTaskRecords.some(({ t }) => t.is_important);

        const msg = `📋 <b>${createdTaskRecords.length > 1 ? `${createdTaskRecords.length} New Tasks Assigned` : 'New Task Assigned'}</b>\n\n` +
          `<b>From:</b> ${director.full_name}\n\n` +
          taskLines +
          (hasImportant ? `\n\n⚠️ <b>One or more tasks are marked IMPORTANT</b>` : '');

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: eaUser.telegram_chat_id,
            text: msg,
            parse_mode: 'HTML',
          }),
        });
      }
    }

    // ── Response ─────────────────────────────────────────────────
    const createdSummary = createdTaskRecords.map(({ taskNumber, t, taskRecord }) => ({
      task_number: taskNumber,
      task_name: t.task_name,
      end_date: t.end_date,
      status: taskRecord.status,
      is_important: t.is_important,
    }));

    return Response.json({
      success: true,
      tasks_created: createdTaskRecords.length,
      assigned_to: assignee.full_name || assignee.email,
      transcription: voiceText,
      tasks: createdSummary,
      message: createdTaskRecords.length === 1
        ? `Task ${createdTaskNumbers[0]} created: "${tasks[0].task_name}" assigned to ${assignee.full_name || assignee.email}, due ${tasks[0].end_date}`
        : `${createdTaskRecords.length} tasks created and linked: ${createdTaskNumbers.join(' → ')}`,
    });

  } catch (error) {
    console.error('[voiceCreateTask] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});