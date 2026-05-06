import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Whisper Transcription — takes an uploaded audio file URL,
 * downloads it, sends to OpenAI Whisper, returns exact transcription.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();
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

    // Send to Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice_recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[whisperTranscribe] Whisper error:', errText);
      return Response.json({ error: 'Transcription failed: ' + errText }, { status: 500 });
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text || '';

    if (!transcript.trim()) {
      return Response.json({ error: 'No speech detected. Please speak clearly and try again.' }, { status: 400 });
    }

    console.log('[whisperTranscribe] Transcript:', transcript);
    return Response.json({ transcript });

  } catch (error) {
    console.error('[whisperTranscribe] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});