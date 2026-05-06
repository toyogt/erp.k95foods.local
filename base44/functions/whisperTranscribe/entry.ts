import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Combined Whisper Transcription + LLM Field Extraction in a single call.
 * Supports English + Hindi (Hinglish) speech.
 * Saves recording URL for audit trail.
 * Returns { transcript, parsed: { task_name, task_details, assigned_to_email, end_date, end_time, is_important } }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, user_list, today, tomorrow, day_after, next_week } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'Missing file_url' }, { status: 400 });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    // Download the audio file
    const audioRes = await fetch(file_url);
    if (!audioRes.ok) {
      return Response.json({ error: 'Failed to download audio file' }, { status: 500 });
    }
    const audioBlob = await audioRes.blob();

    // Send to Whisper — NO language lock so it handles Hindi, English, Hinglish
    const whisperForm = new FormData();
    whisperForm.append('file', audioBlob, 'voice_recording.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('prompt', 'This is a task assignment in Hindi, English, or Hinglish. Common words: kal, aaj, parso, urgent, important, task, kaam, deadline, tak, ko, bolo, bhejo.');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[whisperTranscribe] Whisper error:', errText);
      return Response.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text || '';

    if (!transcript.trim()) {
      return Response.json({ error: 'No speech detected. Please speak clearly and try again.' }, { status: 400 });
    }

    console.log('[whisperTranscribe] Transcript:', transcript);

    // LLM extraction — done server-side to save a round-trip
    const currentYear = new Date().getFullYear();
    const userListStr = user_list || '(no list available)';

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a strict field extractor for task assignments. The transcript may be in Hindi, English, or Hinglish (mixed). Extract fields using ONLY what was spoken — do NOT invent or rephrase.

TRANSCRIPT:
"${transcript}"

TODAY: ${today || ''}

EXTRACT:
1. task_name: Short title (max 100 chars) using the speaker's own words. If Hindi, keep in Hindi/transliterated form.
2. task_details: Extra context from the speaker's words. If nothing extra, empty string.
3. assigned_to_email: Match the speaker's mentioned person name to the closest name below. If no name mentioned, empty string.

TEAM MEMBERS:
${userListStr}

4. end_date: Convert deadline to DD/MM/YYYY:
   - "today"/"aaj" → ${today || ''}
   - "tomorrow"/"kal"/"कल" → ${tomorrow || ''}
   - "day after tomorrow"/"parso"/"परसों" → ${day_after || ''}
   - "next week"/"agle hafte" → ${next_week || ''}
   - Specific date like "15th May"/"15 May" → DD/MM/${currentYear}
   - If NO deadline mentioned → empty string
5. end_time: If time mentioned (e.g. "by 3pm"/"3 baje tak" → "15:00"), else empty string
6. is_important: true ONLY if words like "urgent"/"zaruri"/"important"/"critical"/"ASAP"/"jaldi"/"turant"/"priority" were spoken

RULES:
- Do NOT generate content. Only extract from transcript.
- If something is not mentioned, return empty string or false.
- task_name must use the speaker's actual words.`,
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
        required: ['task_name'],
      },
    });

    return Response.json({
      transcript,
      parsed: {
        task_name: llmRes?.task_name || '',
        task_details: llmRes?.task_details || '',
        assigned_to_email: llmRes?.assigned_to_email || '',
        end_date: llmRes?.end_date || '',
        end_time: llmRes?.end_time || '',
        is_important: llmRes?.is_important || false,
      },
    });

  } catch (error) {
    console.error('[whisperTranscribe] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});