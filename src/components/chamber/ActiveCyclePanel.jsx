import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import ChecklistRunner from '@/components/checklist/ChecklistRunner';
import DowntimeReasonModal from '@/components/downtime/DowntimeReasonModal';

function useCountdown(targetIso) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    if (!targetIso) return;
    function update() { setDiff(Math.max(0, new Date(targetIso) - Date.now())); }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  if (!targetIso) return null;
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
}

/**
 * Props: machine, user, cycles (array of ChamberCycle with status RUNNING), onRefresh
 */
export default function ActiveCyclePanel({ machine, user, cycles, onRefresh }) {
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [checklist, setChecklist] = useState(null); // { stage, check_type, prevDue }
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [abortDowntimeEvent, setAbortDowntimeEvent] = useState(null);
  const [showAbortReason, setShowAbortReason] = useState(false);

  const cycle = cycles.find(c => c.id === selectedCycleId) || cycles[0] || null;
  const countdown = useCountdown(cycle?.next_check_due_at);
  const isOverdue = cycle?.next_check_due_at && new Date(cycle.next_check_due_at) < Date.now();

  async function doInCycleCheck() {
    setChecklist({ stage: 'IN_CYCLE', check_type: 'IN_CYCLE', prevDue: cycle.next_check_due_at });
  }

  async function doStageEnd() {
    setChecklist({ stage: `STAGE_END_${cycle.current_stage}`, check_type: 'STAGE_END', prevDue: null });
  }

  async function doEndCycle() {
    setChecklist({ stage: 'END_CYCLE', check_type: 'END_CYCLE', prevDue: null });
  }

  async function handleChecklistComplete(status, runId) {
    setLoading(true);
    const now = new Date().toISOString();
    const ct = checklist.check_type;
    try {
      // Log the check
      await base44.entities.ChamberCycleCheck.create({
        cycle_id: cycle.cycle_id,
        check_type: ct,
        stage_name: cycle.current_stage,
        due_at: checklist.prevDue || now,
        completed_at: now,
        checklist_run_id: runId || '',
        completed_by: user?.email || '',
      });

      if (ct === 'IN_CYCLE') {
        // Advance next check due
        const tmpl = await base44.entities.ChamberCycleTemplate.filter({ template_id: cycle.template_id }).catch(() => []);
        const intervalMin = tmpl[0]?.interval_minutes || 60;
        const nextDue = new Date(Date.now() + intervalMin * 60000).toISOString();
        await base44.entities.ChamberCycle.update(cycle.id, { next_check_due_at: nextDue });
        setMsg({ ok: true, text: `In-cycle check logged. Next due in ${intervalMin} min.` });
      } else if (ct === 'STAGE_END') {
        // Advance stage
        const tmpl = await base44.entities.ChamberCycleTemplate.filter({ template_id: cycle.template_id }).catch(() => []);
        const stages = tmpl[0]?.stages_json || [];
        const idx = stages.indexOf(cycle.current_stage);
        const nextStage = stages[idx + 1] || null;
        if (nextStage) {
          await base44.entities.ChamberCycle.update(cycle.id, { current_stage: nextStage });
          setMsg({ ok: true, text: `Stage complete. Advanced to: ${nextStage}` });
        } else {
          setMsg({ ok: true, text: 'All stages complete. You can now End the Cycle.' });
        }
      } else if (ct === 'END_CYCLE') {
        await base44.entities.ChamberCycle.update(cycle.id, {
          status: 'COMPLETED',
          ended_at: now,
          ended_by: user?.email || '',
        });
        setMsg({ ok: true, text: 'Cycle completed. Pallet OUT is now allowed.' });
      }
      onRefresh();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setChecklist(null);
    setLoading(false);
  }

  async function handleAbort() {
    if (!window.confirm('Abort this cycle? Pallet OUT will then be allowed.')) return;
    setLoading(true);
    const now = new Date().toISOString();
    // Create downtime event for the abort
    const eventId = `DT-${Date.now()}`;
    const ev = await base44.entities.DowntimeEvent.create({
      event_id: eventId,
      station_type: 'CHAMBER',
      machine_id: cycle.chamber_machine_id,
      cycle_id: cycle.cycle_id,
      started_at: now,
      started_by: user?.email || '',
    }).catch(() => ({ event_id: eventId, started_at: now, id: null }));
    setAbortDowntimeEvent(ev);

    await base44.entities.ChamberCycle.update(cycle.id, {
      status: 'ABORTED',
      ended_at: now,
      ended_by: user?.email || '',
    });
    setLoading(false);
    setShowAbortReason(true);
  }

  async function handleAbortReasonConfirm(reasonCode, notes, photoUrl) {
    if (abortDowntimeEvent?.id) {
      const now = new Date().toISOString();
      const durationMin = (new Date(now) - new Date(abortDowntimeEvent.started_at)) / 60000;
      await base44.entities.DowntimeEvent.update(abortDowntimeEvent.id, {
        ended_at: now,
        ended_by: user?.email || '',
        reason_code: reasonCode || '',
        notes: notes || '',
        photo: photoUrl || '',
        duration_minutes: parseFloat(durationMin.toFixed(2)),
        is_micro_stop: false,
      }).catch(() => {});
    }
    setShowAbortReason(false);
    setAbortDowntimeEvent(null);
    onRefresh();
  }

  if (showAbortReason) return (
    <DowntimeReasonModal
      stationType="CHAMBER"
      durationMinutes={abortDowntimeEvent ? (Date.now() - new Date(abortDowntimeEvent.started_at)) / 60000 : null}
      onConfirm={handleAbortReasonConfirm}
      onCancel={() => { setShowAbortReason(false); onRefresh(); }}
    />
  );

  if (checklist) return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-slate-800 text-white">
        <p className="font-bold">{checklist.check_type.replace('_', ' ')} — {cycle.pallet_id}</p>
        <p className="text-xs opacity-70">Stage: {cycle.current_stage}</p>
      </div>
      <ChecklistRunner
        station_type="CHAMBER"
        stage={checklist.stage}
        reference_type="ChamberCycle"
        reference_id={cycle.cycle_id}
        user={user}
        onComplete={handleChecklistComplete}
        onCancel={() => setChecklist(null)}
      />
    </div>
  );

  if (cycles.length === 0) return (
    <div className="text-center py-12 text-slate-400">
      <p className="text-sm">No active cycles for this chamber.</p>
      <p className="text-xs mt-1">Start a cycle after moving a pallet IN.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Cycle selector if multiple */}
      {cycles.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cycles.map(c => (
            <button key={c.id}
              onClick={() => setSelectedCycleId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${selectedCycleId === c.id || (!selectedCycleId && c.id === cycles[0].id) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
              {c.pallet_id}
            </button>
          ))}
        </div>
      )}

      {cycle && (
        <>
          {/* Status card */}
          <div className="bg-slate-800 text-white rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-60 uppercase tracking-widest">Active Cycle</p>
                <p className="text-xl font-black">{cycle.pallet_id}</p>
              </div>
              <button onClick={onRefresh} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-xs opacity-60">Stage</p>
                <p className="font-bold text-sm">{cycle.current_stage || '—'}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-xs opacity-60">Started</p>
                <p className="font-bold text-sm">{cycle.started_at ? new Date(cycle.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
              </div>
              <div className={`rounded-xl p-2 ${isOverdue ? 'bg-red-500' : 'bg-white/10'}`}>
                <p className="text-xs opacity-60">Next check</p>
                <p className="font-bold text-sm flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />{countdown || '—'}
                </p>
              </div>
            </div>
          </div>

          {msg && (
            <div className={`p-3 rounded-xl text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              {msg.ok ? <CheckCircle2 className="inline w-4 h-4 mr-1" /> : null}{msg.text}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={doInCycleCheck} disabled={loading}
              className={`w-full h-12 rounded-xl ${isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ChevronRight className="w-4 h-4 mr-1" />{isOverdue ? '⚠ In-Cycle Check (OVERDUE)' : 'Do In-Cycle Check'}</>}
            </Button>
            <Button onClick={doStageEnd} disabled={loading} variant="outline" className="w-full h-11 rounded-xl">
              Complete Stage: {cycle.current_stage}
            </Button>
            <Button onClick={doEndCycle} disabled={loading} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              End Cycle
            </Button>
            <Button onClick={handleAbort} disabled={loading} variant="outline" className="w-full h-10 rounded-xl text-red-600 border-red-200 hover:bg-red-50">
              Abort Cycle
            </Button>
          </div>
        </>
      )}
    </div>
  );
}