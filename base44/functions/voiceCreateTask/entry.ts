import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Voice-to-Task API for Apple Shortcuts
 * 
 * Authentication: Custom API key via "x-api-key" header
 * Also requires "x-director-email" header.
 * 
 * Accepts:
 *  - Audio file via multipart form-data (field "audio")
 *  - JSON body with { voice_text: "..." }
 */
Deno.serve(async (req) => {
  console.log('[voiceCreateTask] Request received');
  console.log('[voiceCreateTask] Method:', req.method);
  console.log('[voiceCreateTask] Content-Type:', req.headers.get('content-type'));
  
  try {
    // ── Step 1: Custom API key auth ──────────────────────────────
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('VOICE_TASK_API_KEY');
    if (!apiKey || apiKey !== expectedKey) {
      console.log('[voiceCreateTask] API key mismatch');
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    console.log('[voiceCreateTask] API key validated');

    const directorEmail = req.headers.get('x-director-email');
    if (!directorEmail) {
      return Response.json({ error: 'Missing x-director-email header' }, { status: 400 });
    }
    console.log('[voiceCreateTask] Director email:', directorEmail);

    // ── Step 2: Parse body BEFORE SDK init ───────────────────────
    let voiceText = null;
    let audioBlob = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      console.log('[voiceCreateTask] Parsing multipart form data...');
      const formData = await req.formData();
      const audioFile = formData.get('audio');
      if (!audioFile) {
        return Response.json({ error: 'Missing audio file. Send as form field named "audio".' }, { status: 400 });
      }
      audioBlob = audioFile;
      console.log('[voiceCreateTask] Audio file received:', audioFile.name, audioFile.size, 'bytes');
    } else {
      let rawBody;
      try {
        rawBody = await req.text();
      } catch (_e) {
        rawBody = '';
      }
      console.log('[voiceCreateTask] Raw body length:', rawBody.length);
      if (rawBody) {
        try {
          const body = JSON.parse(rawBody);
          voiceText = body.voice_text;
        } catch (_e) {
          // not JSON
        }
      }
      if (!voiceText || !voiceText.trim()) {
        return Response.json({ error: 'Missing voice_text or audio file' }, { status: 400 });
      }
      console.log('[voiceCreateTask] Voice text:', voiceText);
    }

    // ── Step 3: Init SDK with a new Request (body already consumed) ──
    // Build a fresh request with the original headers but no body
    // The SDK needs the platform-injected headers that come with every function call
    console.log('[voiceCreateTask] Initializing SDK...');
    const sdkReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({}), // dummy body so SDK doesn't fail on empty
    });
    
    let base44;
    try {
      base44 = createClientFromRequest(sdkReq);
      console.log('[voiceCreateTask] SDK initialized successfully');
    } catch (sdkErr) {
      console.error('[voiceCreateTask] SDK init error:', sdkErr.message);
      return Response.json({ error: 'SDK initialization failed: ' + sdkErr.message }, { status: 500 });
    }

    // ── Step 4: Service-role operations ──────────────────────────
    console.log('[voiceCreateTask] Fetching users via service role...');
    let allUsers;
    try {
      allUsers = await base44.asServiceRole.entities.User.list();
      console.log('[voiceCreateTask] Got', allUsers.length, 'users');
    } catch (userErr) {
      console.error('[voiceCreateTask] User list error:', userErr.message);
      console.error('[voiceCreateTask] Error data:', JSON.stringify(userErr.response?.data || userErr));
      return Response.json({ 
        error: 'Failed to fetch users. This is a platform auth issue.',
        detail: userErr.message 
      }, { status: 500 });
    }

    const director = allUsers.find(u => u.email === directorEmail);
    if (!director) {
      return Response.json({ error: `Director not found: ${directorEmail}` }, { status: 400 });
    }

    // Upload audio if present
    let audioFileUrl = null;
    if (audioBlob) {
      console.log('[voiceCreateTask] Uploading audio...');
      const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: audioBlob });
      audioFileUrl = uploadResult.file_url;
      console.log('[voiceCreateTask] Audio uploaded:', audioFileUrl);
    }

    // Get EAs for this director
    const eaMappings = await base44.asServiceRole.entities.EADirectorMapping.filter({
      director_email: director.email,
      is_active: true,
    });

    if (!eaMappings || eaMappings.length === 0) {
      return Response.json({ error: `No EA mapped for director ${director.full_name} (${director.email}). Set up EA-Director mapping first.` }, { status: 400 });
    }

    const eaMapping = eaMappings[0];
    const eaUser = allUsers.find(u => u.email === eaMapping.ea_email);
    const eaEmails = eaMappings.map(m => m.ea_email);

    // Today (IST)
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = `${String(ist.getDate()).padStart(2, '0')}/${String(ist.getMonth() + 1).padStart(2, '0')}/${ist.getFullYear()}`;

    // AI prompt
    const basePrompt = `You are a task extraction assistant for a Director in a company.
Today's date is: ${todayStr}

${audioFileUrl 
  ? 'The Director has recorded an audio voice command to create a task for their Executive Assistant. Listen to the attached audio file carefully and extract the task details from it.'
  : `The Director spoke this voice command to create a task for their Executive Assistant:\n\n"${voiceText}"`}

Extract the following:
1. task_name: A clear, concise title for the task
2. task_details: Any additional details mentioned (if none, leave empty)
3. end_date: The deadline in DD/MM/YYYY format. If "today" → ${todayStr}. If "tomorrow" → calculate. If "next week" → add 7 days. If specific date like "25th April" → DD/MM/YYYY using year ${ist.getFullYear()}. If no date, default 3 days from today.
4. end_time: Time if mentioned (HH:MM 24h), otherwise empty
5. is_important: true if urgent/important/critical/ASAP/priority mentioned, otherwise false
6. transcription: Full text of what was said`;

    const llmParams = {
      prompt: basePrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          task_name: { type: 'string' },
          task_details: { type: 'string' },
          end_date: { type: 'string' },
          end_time: { type: 'string' },
          is_important: { type: 'boolean' },
          transcription: { type: 'string' },
        },
      },
    };

    if (audioFileUrl) {
      llmParams.file_urls = [audioFileUrl];
    }

    console.log('[voiceCreateTask] Calling AI...');
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM(llmParams);
    console.log('[voiceCreateTask] AI result:', JSON.stringify(aiResult));

    if (!aiResult.task_name) {
      return Response.json({
        success: false,
        error: 'Could not understand the voice command. Please try again.',
        transcription: aiResult.transcription || null,
      }, { status: 400 });
    }

    const assignee = eaUser || { email: eaMapping.ea_email, full_name: eaMapping.ea_name || eaMapping.ea_email };

    // Generate task number
    const existing = await base44.asServiceRole.entities.DirectorTask.list('-created_date', 1);
    const lastNum = existing.length > 0 ? parseInt((existing[0].task_number || 'DT-0000').replace('DT-', ''), 10) : 0;
    const taskNumber = `DT-${String(lastNum + 1).padStart(4, '0')}`;

    // Create task
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

    console.log('[voiceCreateTask] Task created:', taskNumber);

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

    // Telegram notification to EA
    if (eaUser?.telegram_chat_id) {
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
            chat_id: eaUser.telegram_chat_id,
            text: msg,
            parse_mode: 'HTML',
          }),
        });
        console.log('[voiceCreateTask] Telegram sent to EA');
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
    console.error('[voiceCreateTask] Unhandled error:', error.message);
    console.error('[voiceCreateTask] Stack:', error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});