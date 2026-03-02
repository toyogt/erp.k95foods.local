import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import ChecklistRunner from '@/components/checklist/ChecklistRunner';

const SHIFT_CODES = ['A', 'B', 'C', 'DAY', 'NIGHT', 'MORNING', 'AFTERNOON'];

// step: 'form' | 'checklist' | 'done'
export default function ShiftHandoverModal({ stationType, machineId, user, currentSession, onDone, onCancel }) {
  const [step, setStep] = useState('form');
  const [toUser, setToUser] = useState('');
  const [shiftCode, setShiftCode] = useState('A');
  const [notes, setNotes] = useState('');
  const [checklistRunId, setChecklistRunId] = useState(null);
  const [saving, setSaving] = useState(false);

  const checklistStage = `HANDOVER_${stationType}`;

  async function handleChecklistDone(runId) {
    setChecklistRunId(runId);
    await completeHandover(runId);
  }

  async function skipChecklist() {
    await completeHandover(null);
  }

  async function completeHandover(runId) {
    setSaving(true);
    const now = new Date().toISOString();
    const handoverId = `HO-${Date.now()}`;
    const newSessionId = `SS-${stationType.slice(0, 3)}-${Date.now()}`;

    // End old session
    await base44.entities.ShiftSession.update(currentSession.id, {
      status: 'ENDED',
      ended_at: now,
      ended_by: user?.email || '',
    }).catch(() => {});

    // Start new session
    const newSession = await base44.entities.ShiftSession.create({
      session_id: newSessionId,
      station_type: stationType,
      machine_id: machineId,
      started_at: now,
      started_by: toUser || user?.email || '',
      shift_code: shiftCode,
      status: 'ACTIVE',
      notes,
    });

    // Create handover record
    await base44.entities.ShiftHandover.create({
      handover_id: handoverId,
      station_type: stationType,
      machine_id: machineId,
      from_user: user?.email || '',
      to_user: toUser,
      handover_at: now,
      checklist_run_id: runId || '',
      old_session_id: currentSession.session_id,
      new_session_id: newSessionId,
      notes,
    });

    setSaving(false);
    setStep('done');
    onDone(newSession);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {step === 'form' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Shift Handover</h3>
              <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="text-xs text-slate-500">From: <b>{user?.email?.split('@')[0]}</b> · {machineId}</div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Incoming Operator</label>
              <input
                style={{ fontSize: '16px' }}
                className="w-full h-12 px-3 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500"
                placeholder="Name or email of incoming operator…"
                value={toUser}
                onChange={e => setToUser(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Next Shift Code</label>
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
                className="w-full h-14 px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything to note for next shift…"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={skipChecklist} disabled={saving || !toUser.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Skip Checklist'}
              </Button>
              <Button className="flex-1 h-11 rounded-xl" onClick={() => setStep('checklist')} disabled={!toUser.trim()}>
                Run Checklist
              </Button>
            </div>
          </div>
        )}

        {step === 'checklist' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800">Handover Checklist</h3>
              <button onClick={() => setStep('form')} className="text-xs text-slate-400 underline">Back</button>
            </div>
            <ChecklistRunner
              stationType={stationType}
              stage={checklistStage}
              user={user}
              machineId={machineId}
              onComplete={handleChecklistDone}
              onCancel={() => setStep('form')}
            />
          </div>
        )}
      </div>
    </div>
  );
}