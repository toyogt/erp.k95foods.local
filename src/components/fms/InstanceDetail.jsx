import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatDateTime, isPC, isAdmin } from '@/lib/fmsHelpers';
import StepTimeline from './StepTimeline';
import ReassignModal from './ReassignModal';
import EscalateModal from './EscalateModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, UserCheck, Bell, Ban, Link2, Copy, CheckCheck } from 'lucide-react';

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
  on_hold: 'bg-yellow-100 text-yellow-700',
};

export default function InstanceDetail({ instanceId, user, users, onClose, onUpdated }) {
  const [instance, setInstance] = useState(null);
  const [steps, setSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reassignStep, setReassignStep] = useState(null);
  const [escalateStep, setEscalateStep] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const load = async () => {
    const [instances, stepList, logList] = await Promise.all([
      base44.entities.FMSProcessInstance.filter({ id: instanceId }),
      base44.entities.FMSStepInstance.filter({ instance_id: instanceId }),
      base44.entities.FMSEscalationLog.filter({ instance_id: instanceId }),
    ]);
    setInstance(instances[0] || null);
    setSteps(stepList.sort((a, b) => a.step_order - b.step_order));
    setLogs(logList.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [instanceId]);

  const activeStep = steps.find(s => s.status === 'active');
  const canIntervene = isPC(user) || isAdmin(user);

  const cancelInstance = async () => {
    if (!window.confirm('Cancel this process instance?')) return;
    await base44.functions.invoke('fmsTriggerProcess', {
      action: 'cancel_instance',
      instance_id: instanceId,
      reason: 'Cancelled by PC',
    });
    onUpdated();
    onClose();
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );

  if (!instance) return null;

  const triggerData = instance.trigger_data || {};

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-lg leading-tight">{instance.title || instance.process_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[instance.status] || 'bg-slate-100 text-slate-500'}`}>
                {instance.status}
              </span>
              <span className="text-xs text-slate-400">Started {formatDateTime(instance.triggered_at)}</span>
              <span className="text-xs text-slate-400">by {instance.triggered_by}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Trigger data */}
          {Object.keys(triggerData).length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Process Details</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(triggerData).map(([k, v]) => v && (
                  <div key={k}>
                    <p className="text-xs text-slate-400 capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-medium text-slate-700">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PC Actions */}
          {canIntervene && instance.status === 'active' && activeStep && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEscalateStep(activeStep)} className="gap-1.5 min-h-[40px]">
                <Bell className="w-3.5 h-3.5" /> Send Reminder
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReassignStep(activeStep)} className="gap-1.5 min-h-[40px]">
                <UserCheck className="w-3.5 h-3.5" /> Reassign Step
              </Button>
              <Button size="sm" variant="outline" onClick={cancelInstance} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 min-h-[40px]">
                <Ban className="w-3.5 h-3.5" /> Cancel Instance
              </Button>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Steps Progress</p>
            <StepTimeline steps={steps} />
          </div>

          {/* Audit log */}
          {logs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Activity Log</p>
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-3 text-xs">
                    <span className="text-slate-400 shrink-0">{formatDateTime(log.performed_at)}</span>
                    <span className="text-slate-600">
                      <span className="font-medium capitalize">{log.action_type}</span>
                      {log.message && ` — ${log.message}`}
                      {log.performed_by && ` (by ${log.performed_by})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {reassignStep && (
        <ReassignModal
          stepInstance={reassignStep}
          users={users}
          onClose={() => setReassignStep(null)}
          onDone={() => { setReassignStep(null); load(); onUpdated(); }}
        />
      )}
      {escalateStep && (
        <EscalateModal
          stepInstance={escalateStep}
          onClose={() => setEscalateStep(null)}
          onDone={() => { setEscalateStep(null); load(); }}
        />
      )}
    </div>
  );
}