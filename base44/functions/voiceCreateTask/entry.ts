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
 * Smart behaviour:
 *  - Single action → creates one DirectorTask
 *  - Multiple related actions → auto-creates a Project + linked DirectorTasks with dependencies
 */

// ── Helper: generate next task number ────────────────────────────────────────
async function getNextTaskNumber(base44) {
  const existing = await base44.asServiceRole.entities.DirectorTask.list('-created_date', 1);
  const lastNum = existing.length > 0
    ? parseInt((existing[0].task_number || 'DT-0000').replace('DT-', ''), 10)
    : 0;
  return lastNum;
}

// ── Helper: generate next project number ─────────────────────────────────────
async function getNextProjectNumber(base44) {
  const existing = await base44.asServiceRole.entities.Project.list('-created_date', 1);
  const lastNum = existing.length > 0
    ? parseInt((existing[0].project_number || 'PRJ-0000').replace('PRJ-', ''), 10)
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

    // ── AI extraction ─────────────────────────────────────────────────────────
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a smart task and project extraction assistant for a Director in a company.
Today's date is: ${todayStr}
The Director's Executive Assistant email is: ${assignee.email}

The Director spoke this voice command:
"${voiceText}"

RULES:
1. If the command describes a SINGLE, standalone action or a single goal (even if it implies some follow-up) → set action_type to "create_standalone_task". PREFER this option when in doubt.
2. ONLY use "create_project" if the command EXPLICITLY describes 2 or more clearly distinct, named actions that are meaningfully different from each other (not just follow-up steps of the same action).
   - Keep tasks count to the MINIMUM necessary. Aim for 2 tasks maximum unless the command very explicitly lists more.
   - DO NOT split a single action into sub-steps. For example: "negotiate and get updates" = ONE task, not two.
   - DO NOT create a separate task just for "follow up" or "check in" — include it in the task details of the main task.
   - Generate a concise, professional project name that captures the overall goal.
   - Generate a brief project description (1-2 sentences).
   - If a task must happen AFTER another, set predecessor_task_index to the 0-based index of that task.
   - The first task in a sequence always has no predecessor.
3. For end dates:
   - "today" → ${todayStr}
   - "tomorrow" → calculate from today
   - "next week" → add 7 days
   - A specific date like "25th April" → use year ${ist.getFullYear()}
   - If only an overall deadline is given for a project, distribute deadlines across tasks proportionally (earlier tasks get earlier deadlines).
   - If no deadline is mentioned at all, default to: ${defaultEndStr}
4. is_important: true if urgent/important/critical/ASAP/priority is mentioned.
5. All dates must be in DD/MM/YYYY format.
6. assigned_to_email must always be set to: ${assignee.email}`,
      response_json_schema: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: ['create_standalone_task', 'create_project'],
          },
          project_name: { type: 'string' },
          project_description: { type: 'string' },
          project_end_date: { type: 'string' },
          is_important: { type: 'boolean' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_name: { type: 'string' },
                task_details: { type: 'string' },
                end_date: { type: 'string' },
                end_time: { type: 'string' },
                predecessor_task_index: { type: 'number' },
              },
            },
          },
        },
        required: ['action_type', 'tasks'],
      },
    });

    if (!aiResult || !Array.isArray(aiResult.tasks) || aiResult.tasks.length === 0) {
      // Log failed attempt
      await base44.asServiceRole.entities.VoiceCommandLog.create({
        director_email: director.email,
        director_name: director.full_name,
        transcript: voiceText,
        input_mode: contentType.includes('multipart/form-data') ? 'audio' : 'text',
        action_type: 'failed',
        tasks_created: 0,
        task_numbers: [],
        ai_parsed_json: JSON.stringify(aiResult || {}),
        error_message: 'AI returned no tasks',
      });
      return Response.json({
        success: false,
        error: 'Could not understand the voice command. Please try again.',
        transcription: voiceText,
      }, { status: 400 });
    }

    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const isImportant = aiResult.is_important || false;

    // ══════════════════════════════════════════════════════════════════════════
    // CASE A: Single standalone task
    // ══════════════════════════════════════════════════════════════════════════
    if (aiResult.action_type === 'create_standalone_task') {
      const taskData = aiResult.tasks[0];
      const lastTaskNum = await getNextTaskNumber(base44);
      const taskNumber = `DT-${String(lastTaskNum + 1).padStart(4, '0')}`;

      const task = await base44.asServiceRole.entities.DirectorTask.create({
        task_number: taskNumber,
        task_name: taskData.task_name,
        task_details: taskData.task_details || '',
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
        end_date: taskData.end_date || defaultEndStr,
        end_time: taskData.end_time || '',
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
          `<b>Task:</b> ${taskData.task_name} (${taskNumber})\n` +
          `<b>From:</b> ${director.full_name}\n` +
          `<b>Deadline:</b> ${taskData.end_date || defaultEndStr}${taskData.end_time ? ' ' + taskData.end_time : ''}` +
          (isImportant ? `\n\n⚠️ <b>IMPORTANT</b>` : '') +
          (taskData.task_details ? `\n\n${taskData.task_details}` : '');
        await sendTelegram(telegramToken, eaUser.telegram_chat_id, msg);
      }

      // Log standalone task
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
        task_name: taskData.task_name,
        assigned_to: assignee.full_name || assignee.email,
        end_date: taskData.end_date || defaultEndStr,
        is_important: isImportant,
        transcription: voiceText,
        message: `Task ${taskNumber} created: "${taskData.task_name}" assigned to ${assignee.full_name || assignee.email}, due ${taskData.end_date || defaultEndStr}`,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CASE B: Multi-task → auto-create Project + linked DirectorTasks
    // ══════════════════════════════════════════════════════════════════════════
    const lastProjNum = await getNextProjectNumber(base44);
    const projectNumber = `PRJ-${String(lastProjNum + 1).padStart(4, '0')}`;

    const project = await base44.asServiceRole.entities.Project.create({
      project_number: projectNumber,
      project_name: aiResult.project_name || `Project from voice - ${todayStr}`,
      project_description: aiResult.project_description || '',
      status: 'in_progress',
      start_date: todayStr,
      end_date: aiResult.project_end_date || defaultEndStr,
      director_email: director.email,
      director_name: director.full_name,
      created_by_email: director.email,
      created_by_name: director.full_name,
      team_member_emails: [assignee.email],
      is_important: isImportant,
    });

    console.log(`[voiceCreateTask] Created project ${projectNumber}: ${project.id}`);

    // Create tasks sequentially so we can wire predecessor IDs
    const createdTasks = [];
    let taskCounter = await getNextTaskNumber(base44);

    for (let i = 0; i < aiResult.tasks.length; i++) {
      const taskData = aiResult.tasks[i];
      taskCounter++;
      const taskNumber = `DT-${String(taskCounter).padStart(4, '0')}`;

      // Determine predecessor
      let predecessorTaskIds = [];
      let predecessorTaskNumbers = [];
      let taskStatus = 'open';

      if (typeof taskData.predecessor_task_index === 'number' && taskData.predecessor_task_index >= 0) {
        const pred = createdTasks[taskData.predecessor_task_index];
        if (pred) {
          predecessorTaskIds = [pred.id];
          predecessorTaskNumbers = [pred.task_number];
          taskStatus = 'blocked';
        }
      }

      const task = await base44.asServiceRole.entities.DirectorTask.create({
        task_number: taskNumber,
        task_name: taskData.task_name,
        task_details: taskData.task_details || '',
        task_type: 'project',
        project_id: project.id,
        project_name: project.project_name,
        predecessor_task_ids: predecessorTaskIds,
        predecessor_task_numbers: predecessorTaskNumbers,
        assigned_to_email: assignee.email,
        assigned_to_name: assignee.full_name || assignee.email,
        assigned_by_email: director.email,
        assigned_by_name: director.full_name,
        director_email: director.email,
        director_name: director.full_name,
        is_important: isImportant,
        start_date: '',
        start_time: '',
        end_date: taskData.end_date || defaultEndStr,
        end_time: taskData.end_time || '',
        notification_time: '16:00',
        status: taskStatus,
        overdue_notified: false,
        ea_emails: eaEmails,
      });

      createdTasks.push({ id: task.id, task_number: taskNumber, task_name: taskData.task_name });

      await base44.asServiceRole.entities.DirectorTaskLog.create({
        task_id: task.id,
        task_number: taskNumber,
        action: 'created',
        performed_by_email: director.email,
        performed_by_name: director.full_name,
        details: `Task created via voice command as part of project ${projectNumber}: "${voiceText}"`,
        timestamp: new Date().toISOString(),
      });
    }

    // Send single Telegram summary for the project
    if (eaUser?.telegram_chat_id && telegramToken) {
      const taskLines = createdTasks.map((t, idx) => {
        const td = aiResult.tasks[idx];
        const statusLabel = td.predecessor_task_index >= 0 ? '🔒 Blocked' : '📌 Open';
        return `${statusLabel} <b>${t.task_number}:</b> ${t.task_name} — Due: ${td.end_date || defaultEndStr}`;
      }).join('\n');

      const msg = `🗂️ <b>New Project Created</b>\n\n` +
        `<b>Project:</b> ${project.project_name} (${projectNumber})\n` +
        `<b>From:</b> ${director.full_name}\n` +
        `<b>Overall Deadline:</b> ${aiResult.project_end_date || defaultEndStr}\n` +
        (isImportant ? `⚠️ <b>IMPORTANT</b>\n` : '') +
        `\n<b>Tasks (${createdTasks.length}):</b>\n${taskLines}`;

      await sendTelegram(telegramToken, eaUser.telegram_chat_id, msg);
    }

    // Log project creation
    await base44.asServiceRole.entities.VoiceCommandLog.create({
      director_email: director.email,
      director_name: director.full_name,
      transcript: voiceText,
      input_mode: contentType.includes('multipart/form-data') ? 'audio' : 'text',
      action_type: 'create_project',
      tasks_created: createdTasks.length,
      project_id: project.id,
      project_number: projectNumber,
      task_numbers: createdTasks.map(t => t.task_number),
      ai_parsed_json: JSON.stringify(aiResult),
    });

    return Response.json({
      success: true,
      action_type: 'create_project',
      project_number: projectNumber,
      project_name: project.project_name,
      project_end_date: aiResult.project_end_date || defaultEndStr,
      tasks_created: createdTasks.length,
      tasks: createdTasks,
      assigned_to: assignee.full_name || assignee.email,
      is_important: isImportant,
      transcription: voiceText,
      message: `Project ${projectNumber} "${project.project_name}" created with ${createdTasks.length} tasks assigned to ${assignee.full_name || assignee.email}.`,
    });

  } catch (error) {
    console.error('[voiceCreateTask] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});