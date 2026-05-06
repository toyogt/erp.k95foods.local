import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import moment from 'moment';

/**
 * VoiceTaskInput — optimised for speed (single backend call does Whisper + LLM).
 * Supports Hindi, English, Hinglish.
 * Saves recording URL for future audit.
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
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice_task.webm', { type: 'audio/webm' });

      // Upload audio file (saved permanently for audit)
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Build user name list for matching
      const userList = (users || [])
        .filter(u => u.email && u.full_name)
        .map(u => `${u.full_name} (${u.email})`)
        .join('\n');

      // Single backend call — Whisper transcription + LLM extraction combined
      setProcessingStep('Transcribing and extracting…');

      const res = await base44.functions.invoke('whisperTranscribe', {
        file_url,
        user_list: userList || '',
        today: moment().format('DD/MM/YYYY'),
        tomorrow: moment().add(1, 'day').format('DD/MM/YYYY'),
        day_after: moment().add(2, 'days').format('DD/MM/YYYY'),
        next_week: moment().add(7, 'days').format('DD/MM/YYYY'),
      });

      const { transcript, parsed } = res.data || {};

      if (!transcript || !transcript.trim()) {
        setError('No speech detected. Please speak clearly and try again.');
        setProcessing(false);
        return;
      }

      onParsed({
        task_name: parsed?.task_name || '',
        task_details: parsed?.task_details || '',
        assigned_to_email: parsed?.assigned_to_email || '',
        end_date: parsed?.end_date || '',
        end_time: parsed?.end_time || '',
        is_important: parsed?.is_important || false,
        transcription: transcript,
        recording_url: file_url,
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
          🔴 Recording… Speak in Hindi or English. Tap "Stop" when done.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>
      )}
    </div>
  );
}