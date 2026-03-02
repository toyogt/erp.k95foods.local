import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

const SHIFT_CODES = ['A', 'B', 'C', 'DAY', 'NIGHT', 'MORNING', 'AFTERNOON'];

export default function ShiftStartModal({ stationType, machineId, user, onStarted, onCancel }) {
  const [shiftCode, setShiftCode] = useState('A');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    setSaving(true);
    const now = new Date().toISOString();
    const sessionId = `SS-${stationType.slice(0, 3)}-${Date.now()}`;
    const s = await base44.entities.ShiftSession.create({
      session_id: sessionId,
      station_type: stationType,
      machine_id: machineId,
      started_at: now,
      started_by: user?.email || '',
      shift_code: shiftCode,
      status: 'ACTIVE',
      notes,
    });
    onStarted(s);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Start Shift</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="text-xs text-slate-500">Station: <b>{stationType}</b> · Machine: <b>{machineId}</b></div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Shift Code</label>
          <div className="flex flex-wrap gap-2">
            {SHIFT_CODES.map(c => (
              <button key={c} onClick={() => setShiftCode(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors
                  ${shiftCode === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Notes (optional)</label>
          <textarea
            className="w-full h-16 px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes for this shift…"
          />
        </div>

        <Button onClick={handleStart} disabled={saving} className="w-full h-11 rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Shift'}
        </Button>
      </div>
    </div>
  );
}