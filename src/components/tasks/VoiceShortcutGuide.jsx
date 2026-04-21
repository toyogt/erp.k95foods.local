import { Smartphone, Mic, Zap } from 'lucide-react';

export default function VoiceShortcutGuide() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Voice Task Creation — iPhone Shortcut</h3>
          <p className="text-sm text-slate-500">Record audio → AI transcribes & creates task automatically</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> How it works
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm mb-2">1</div>
            <p className="font-medium text-slate-700">Record</p>
            <p className="text-slate-500 text-xs mt-0.5">Tap the shortcut and speak your task, e.g. "Ask Ramesh to prepare MIS report by Friday, urgent"</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm mb-2">2</div>
            <p className="font-medium text-slate-700">AI Transcribes & Parses</p>
            <p className="text-slate-500 text-xs mt-0.5">Audio is sent to the server. AI transcribes it, extracts task name, assignee, deadline, and priority — all in one step</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm mb-2">3</div>
            <p className="font-medium text-slate-700">Task Created</p>
            <p className="text-slate-500 text-xs mt-0.5">Task is created instantly and the assignee gets a Telegram notification</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <Mic className="w-4 h-4 text-red-500" /> Setup Steps (Apple Shortcuts)
        </h4>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">1.</span>
            <span>Open the <strong>Shortcuts</strong> app on your iPhone</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">2.</span>
            <span>Tap <strong>+</strong> to create a new shortcut</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">3.</span>
            <span>Add action: <strong>"Record Audio"</strong> — this records your voice as an audio file</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">4.</span>
            <span>Add action: <strong>"Get Contents of URL"</strong> (this sends the audio to the server)</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">5.</span>
            <div>
              <span>Configure the URL action:</span>
              <ul className="mt-1.5 space-y-1.5 text-xs text-slate-500">
                <li>• <strong>URL:</strong> Your function URL (Dashboard → Code → Functions → voiceCreateTask)</li>
                <li>• <strong>Method:</strong> POST</li>
                <li>• <strong>Request Body:</strong> Form</li>
                <li>• Add field — Key: <strong>audio</strong>, Type: <strong>File</strong>, Value: <strong>Recorded Audio</strong> (select from previous step)</li>
                <li>• <strong>Headers:</strong> Add your auth token header</li>
              </ul>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">6.</span>
            <span>Add action: <strong>"Get Dictionary Value"</strong> — get key <strong>message</strong> from the response</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">7.</span>
            <span>Add action: <strong>"Show Result"</strong> — displays the confirmation message</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-slate-400 shrink-0">8.</span>
            <span>Name it <strong>"Create Task"</strong> — add to Home Screen or trigger via Siri: "Hey Siri, Create Task"</span>
          </li>
        </ol>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-medium text-amber-800">Important</p>
        <p className="text-xs text-amber-700 mt-1">
          The function URL and authentication token are in your dashboard under Code → Functions → voiceCreateTask. 
          You need to add the auth token as a header for the shortcut to work. The AI handles transcription — no need for Apple's "Dictate Text" action.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h4 className="font-semibold text-slate-700 text-sm mb-2">Example Voice Commands</h4>
        <div className="space-y-2 text-sm text-slate-600">
          <p>🗣️ "Ask Ramesh to complete the purchase report by tomorrow"</p>
          <p>🗣️ "Urgent — tell Priya to send vendor invoices by 28th April"</p>
          <p>🗣️ "Create a task for Akul to review production data, due next Monday"</p>
          <p>🗣️ "Assign stock audit to the store manager by end of this week, it's important"</p>
        </div>
      </div>
    </div>
  );
}