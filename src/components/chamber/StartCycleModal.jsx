import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function genId() { return 'CYC-' + Date.now().toString(36).toUpperCase(); }

/**
 * Props: machine, user, pallet, onStarted(cycle), onSkip
 */
export default function StartCycleModal({ machine, user, pallet, onStarted, onSkip }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTmpl, setSelectedTmpl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.ChamberCycleTemplate.filter({ is_active: true }).then(t => {
      setTemplates(t);
      if (t.length === 1) setSelectedTmpl(t[0]);
    }).finally(() => setLoading(false));
  }, []);

  async function handleStart() {
    if (!selectedTmpl) return;
    setSaving(true);
    const now = new Date();
    const nextDue = new Date(now.getTime() + (selectedTmpl.interval_minutes || 60) * 60000).toISOString();
    const stages = selectedTmpl.stages_json || [];
    const cycle = await base44.entities.ChamberCycle.create({
      cycle_id: genId(),
      chamber_machine_id: machine.machine_id,
      pallet_id: pallet.pallet_id,
      template_id: selectedTmpl.template_id,
      status: 'RUNNING',
      started_at: now.toISOString(),
      started_by: user?.email || '',
      current_stage: stages[0] || '',
      next_check_due_at: nextDue,
    });
    setSaving(false);
    onStarted(cycle);
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div>
        <p className="font-bold text-slate-900">Start a Chamber Cycle?</p>
        <p className="text-sm text-slate-500 mt-0.5">Pallet {pallet?.pallet_id} is now in the chamber.</p>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">No active cycle templates found. Create one in Master Data first.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Template</p>
          {templates.map(t => (
            <button key={t.id} onClick={() => setSelectedTmpl(t)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedTmpl?.id === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <p className="font-semibold text-sm text-slate-800">{t.name}</p>
              <p className="text-xs text-slate-500">Check every {t.interval_minutes} min · Stages: {(t.stages_json || []).join(' → ')}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onSkip}>Skip for now</Button>
        <Button className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700" onClick={handleStart} disabled={!selectedTmpl || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Cycle'}
        </Button>
      </div>
    </div>
  );
}