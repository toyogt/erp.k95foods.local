import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import moment from 'moment';

/**
 * VoiceTaskInput
 * Records audio → OpenAI Whisper (exact transcription via backend) → LLM parses transcript → fills form fields.
 * The transcription is shown verbatim. LLM only structures the exact words spoken into fields.
 */
export default function VoiceTaskInput({ onParsed, users }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        processAudio();
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access denied. Please allow microphone permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const processAudio = async () => {
    setProcessing(true);
    setProcessingStep('Uploading audio…');

    try {
      // Build audio file from chunks
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice_task.webm', { type: 'audio/webm' });

      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Step 1: Get exact transcription from Whisper via backend
      setProcessingStep('Transcribing your voice…');
      const whisperRes = await base44.functions.invoke('whisperTranscribe', { file_url });
      const transcript = whisperRes.data?.transcript;

      if (!transcript || !transcript.trim()) {
        setError('No speech detected. Please speak clearly and try again.');
        setProcessing(false);
        return;
      }

      // Step 2: Parse the exact transcript into structured form fields using LLM
      setProcessingStep('Extracting task details…');

      const todayStr = moment().format('DD/MM/YYYY');
      const tomorrowStr = moment().add(1, 'day').format('DD/MM/YYYY');
      const nextWeekStr = moment().add(7, 'days').format('DD/MM/YYYY');
      const dayAfterStr = moment().add(2, 'days').format('DD/MM/YYYY');
      const defaultEndStr = moment().add(3, 'days').format('DD/MM/YYYY');

      // Build user name list for matching
      const userList = (users || [])
        .filter(u => u.email && u.full_name)
        .map(u => `${u.full_name} (${u.email})`)
        .join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a strict field extractor. You MUST only use the exact words from the transcript below — do NOT add, rephrase, or invent any information.

TRANSCRIPT:
"${transcript}"

TODAY: ${todayStr}

EXTRACT these fields using ONLY what is spoken:

1. task_name: A short title (max 100 chars) using the speaker's own words. Do NOT rephrase.
2. task_details: Longer description if the speaker gave extra context. Use their exact words. If nothing extra was said, leave empty.
3. assigned_to_email: If the speaker mentioned a person's name, match it to the closest name below and return their email. If no name mentioned, return empty string.

TEAM MEMBERS:
${userList || '(no list available)'}

4. end_date: If a deadline was mentioned, convert to DD/MM/YYYY:
   - "today" → ${todayStr}
   - "tomorrow" → ${tomorrowStr}
   - "day after tomorrow" → ${dayAfterStr}
   - "next week" → ${nextWeekStr}
   - Specific date like "15th May" → DD/MM/${moment().year()}
   - If NO deadline mentioned → empty string
5. end_time: If a time was mentioned (e.g. "by 3pm" → "15:00"), else empty string
6. is_important: true ONLY if words like "urgent", "important", "critical", "ASAP", "priority" were actually spoken

CRITICAL RULES:
- Do NOT generate or invent content. Only extract from the transcript.
- If something is not mentioned, leave the field as empty string or false.
- task_name must use the speaker's actual words, not your interpretation.`,
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

      onParsed({
        task_name: result?.task_name || '',
        task_details: result?.task_details || '',
        assigned_to_email: result?.assigned_to_email || '',
        end_date: result?.end_date || '',
        end_time: result?.end_time || '',
        is_important: result?.is_important || false,
        transcription: transcript,
      });

      setProcessing(false);
      setProcessingStep('');
    } catch (err) {
      console.error('Voice processing error:', err);
      setError('Failed to process voice. Please try again.');
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-800">Processing Voice…</p>
          <p className="text-xs text-indigo-500">{processingStep}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recording ? (
        <Button
          type="button"
          variant="destructive"
          onClick={stopRecording}
          className="w-full h-14 text-base gap-3 rounded-xl animate-pulse"
        >
          <Square className="w-5 h-5" />
          Stop Recording
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={startRecording}
          className="w-full h-14 text-base gap-3 rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
        >
          <Mic className="w-5 h-5" />
          Record Voice to Auto-Fill Task
        </Button>
      )}

      {recording && (
        <p className="text-xs text-center text-red-500 font-medium">
          🔴 Recording… Describe the task, person, deadline. Tap "Stop" when done.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>
      )}
    </div>
  );
}