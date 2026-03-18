import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, User } from 'lucide-react';
import { formatDue, isDelayed, formatDelay, getDelayMinutes } from '@/lib/tatUtils';
import EscalateModal from './EscalateModal';
import ReassignModal from './ReassignModal';

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-slate-100 text-slate-500 border-slate-200',
  delayed: 'bg-red-100 text-red-700 border-red-200',
  skipped: 'bg-yellow-100 text-yellow-600 border-yellow-200',
};

export default function InstanceDetail({ instance, user, onUpdate }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [escalateStep, setEscalateStep] = useState(null);
  const [reassignStep, setReassignStep] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isPC = user?.role === 'pc' || isAdmin;

  const loadSteps = async () => {
    const s = await base44.entities.StepInstance.filter({ process_instance_id: instance.id });
    s.sort((a, b) => a.step_number - b.step_number);
    setSteps(s);
    setLoading(false);
  };

  useEffect(() => { loadSteps(); }, [instance.id]);

  const handleComplete = async (stepInst) => {
    setCompleting(stepInst.id);
    try {
      const now = new Date();
      const isLate = now > new Date(stepInst.due_at);
      const delayMins = isLate ? Math.floor((now - new Date(stepInst.due_at)) / 60000) : 0;
      await base44.entities.StepInstance.update(stepInst.id, {
        status: 'completed',
        completed_at: now.toISOString(),
        is_delayed: isLate,
        delay_minutes: delayMins,
        remarks: remarks || 'Completed',
      });
      // Activate next step
      const nextStep = steps.find(s => s.step_number === stepInst.step_number + 1);
      if (nextStep) {
        await base44.entities.StepInstance.update(nextStep.id, {
          status: 'active',
          started_at: now.toISOString(),
        });
        await base44.entities.ProcessInstance.update(instance.id, { current_step_number: nextStep.step_number });
      } else {
        await base44.entities.ProcessInstance.update(instance.id, {
          status: 'completed',
          completed_at: now.toISOString(),
        });
      }
      setRemarks('');
      await loadSteps();
      onUpdate?.();
    } finally {
      setCompleting(null);
    }
  };

  const canComplete = (s) => {
    if (s.status !== 'active') return false;
    if (s.completion_type === 'auto') return false;
    if (isPC) return true;
    return s.assignee_email === user?.email;
  };

  if (loading) return <div className="p-6 text-center text-slate-500 text-sm">Loading steps…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-semibold text-slate-800">{instance.title}</h3>
        <Badge className={`${STATUS_COLORS[instance.status]} border text-xs`}>{instance.status}</Badge>
      </div>
      <div className="text-xs text-slate-500 px-1">
        {instance.process_name} · Started {new Date(instance.started_at).toLocaleDateString('en-IN')}
        {instance.started_by_name && ` by ${instance.started_by_name}`}
      </div>

      <div className="space-y-2">
        {steps.map((s, idx) => {
          const delayed = isDelayed(s);
          const delayMins = delayed ? getDelayMinutes(s) : 0;
          const isActive = s.status === 'active';
          return (
            <div key={s.id} className={`rounded-xl border p-4 transition-all ${
              isActive ? 'border-blue-300 bg-blue-50' :
              s.status === 'completed' ? 'border-green-200 bg-green-50/50' :
              delayed ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  s.status === 'completed' ? 'bg-green-500 text-white' :
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {s.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : s.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.step_name}</span>
                    <Badge className={`${STATUS_COLORS[s.status] || STATUS_COLORS.pending} border text-xs`}>{s.status}</Badge>
                    {delayed && (
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />{formatDelay(delayMins)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    {s.assignee_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.assignee_name}</span>}
                    {s.due_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due: {formatDue(s.due_at)}</span>}
                    {s.completed_at && <span className="text-green-600">✓ Done {new Date(s.completed_at).toLocaleDateString('en-IN')}</span>}
                  </div>
                  {s.remarks && s.status === 'completed' && (
                    <p className="text-xs text-slate-500 mt-1 italic">"{s.remarks}"</p>
                  )}

                  {/* Actions for active step */}
                  {isActive && (
                    <div className="mt-3 space-y-2">
                      {canComplete(s) && (
                        <>
                          <Textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                            placeholder="Remarks (optional)" className="text-sm" rows={1} />
                          <Button size="sm" onClick={() => handleComplete(s)}
                            disabled={completing === s.id}
                            className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white">
                            {completing === s.id ? 'Completing…' : '✓ Mark Complete'}
                          </Button>
                        </>
                      )}
                      {isPC && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEscalateStep(s)}
                            className="flex-1 min-h-[44px] text-orange-600 border-orange-300">
                            Escalate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReassignStep(s)}
                            className="flex-1 min-h-[44px]">
                            Reassign
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {escalateStep && (
        <EscalateModal stepInstance={escalateStep} user={user}
          onDone={() => { setEscalateStep(null); loadSteps(); }}
          onClose={() => setEscalateStep(null)} />
      )}
      {reassignStep && (
        <ReassignModal stepInstance={reassignStep}
          onDone={() => { setReassignStep(null); loadSteps(); }}
          onClose={() => setReassignStep(null)} />
      )}
    </div>
  );
}