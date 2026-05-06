import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Sparkles } from 'lucide-react';
import moment from 'moment';

/**
 * VoiceTaskInput
 * Records audio → Whisper transcription via UploadFile + InvokeLLM → fills form fields
 * Does NOT create the task — only returns parsed data for the parent to apply.
 */
export default function VoiceTaskInput({ onParsed }) {
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
    } catch (err) {
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

      // Transcribe + parse using LLM with file attachment
      setProcessingStep('Understanding your voice…');

      const todayStr = moment().format('DD/MM/YYYY');
      const defaultEndStr = moment().add(3, 'days').format('DD/MM/YYYY');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a task extraction assistant. 
The attached audio file is a voice recording of someone describing a task they want to assign.

Today's date is: ${todayStr}

STEPS:
1. First transcribe the audio into text.
2. Then extract task details from the transcription.

RULES:
- Extract a clear task_name (short title, max 100 chars)
- Extract task_details (detailed description of what needs to be done)
- Extract end_date in DD/MM/YYYY format:
  - "today" → ${todayStr}
  - "tomorrow" → ${moment().add(1, 'day').format('DD/MM/YYYY')}
  - "next week" → ${moment().add(7, 'days').format('DD/MM/YYYY')}
  - "day after tomorrow" → ${moment().add(2, 'days').format('DD/MM/YYYY')}
  - specific date like "15th May" → use current year ${moment().year()}
  - If no deadline mentioned → ${defaultEndStr}
- Extract end_time in HH:MM 24h format if mentioned (e.g. "by 3pm" → "15:00"), else empty string
- Set is_important to true if words like urgent, important, critical, ASAP, priority are mentioned
- transcription: the raw transcribed text

All dates MUST be DD/MM/YYYY format.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            transcription: { type: 'string' },
            task_name: { type: 'string' },
            task_details: { type: 'string' },
            end_date: { type: 'string' },
            end_time: { type: 'string' },
            is_important: { type: 'boolean' },
          },
          required: ['task_name', 'transcription'],
        },
      });

      if (!result || !result.task_name) {
        setError('Could not understand the recording. Please try again or speak more clearly.');
        setProcessing(false);
        return;
      }

      onParsed({
        task_name: result.task_name,
        task_details: result.task_details || '',
        end_date: result.end_date || defaultEndStr,
        end_time: result.end_time || '',
        is_important: result.is_important || false,
        transcription: result.transcription || '',
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
          <Sparkles className="w-4 h-4" />
        </Button>
      )}

      {recording && (
        <p className="text-xs text-center text-red-500 font-medium">
          🔴 Recording… Describe the task, deadline, and urgency. Tap "Stop" when done.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>
      )}
    </div>
  );
}