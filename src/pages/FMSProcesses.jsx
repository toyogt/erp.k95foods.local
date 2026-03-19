import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ProcessForm from '@/components/fms/ProcessForm';
import StepForm from '@/components/fms/StepForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  GripVertical, Play, GitBranch, Loader2
} from 'lucide-react';
import { isProcessDesigner } from '@/lib/fmsHelpers';

export default function FMSProcesses() {
  const [user, setUser] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [steps, setSteps] = useState({}); // processId -> steps[]
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [editProcess, setEditProcess] = useState(null);
  const [showStepForm, setShowStepForm] = useState(null); // { processId, step? }

  const load = useCallback(async () => {
    const [me, procs, userList] = await Promise.all([
      base44.auth.me(),
      base44.entities.FMSProcess.list('-created_date', 100),
      base44.entities.User.list(),
    ]);
    setUser(me);
    setProcesses(procs);
    setUsers(userList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSteps = async (processId) => {
    if (steps[processId]) return;
    const s = await base44.entities.FMSProcessStep.filter({ process_id: processId }, 'step_order', 100);
    setSteps(prev => ({ ...prev, [processId]: s.sort((a, b) => a.step_order - b.step_order) }));
  };

  const toggleExpanded = (id) => {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id]) loadSteps(id);
      return next;
    });
  };

  const deleteProcess = async (p) => {
    if (!window.confirm(`Delete process "${p.name}"? This cannot be undone.`)) return;
    await base44.entities.FMSProcess.delete(p.id);
    load();
  };

  const deleteStep = async (step) => {
    if (!window.confirm(`Delete step "${step.name}"?`)) return;
    // Optimistically remove from local state immediately
    const processId = step.process_id;
    setSteps(prev => ({ ...prev, [processId]: (prev[processId] || []).filter(s => s.id !== step.id) }));
    await base44.entities.FMSProcessStep.delete(step.id);
  };

  const toggleActive = async (p) => {
    await base44.entities.FMSProcess.update(p.id, { is_active: !p.is_active });
    load();
  };

  const canEdit = isProcessDesigner(user);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Process Templates</h1>
            <p className="text-slate-500 text-sm mt-1">Define multi-step business processes and their steps</p>
          </div>
          {canEdit && (
            <Button onClick={() => { setEditProcess(null); setShowProcessForm(true); }} className="gap-2 min-h-[44px]">
              <Plus className="w-4 h-4" /> New Process
            </Button>
          )}
        </div>

        {processes.length === 0 ? (
          <div className="text-center py-20">
            <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No processes yet</p>
            {canEdit && <Button className="mt-4 min-h-[44px]" onClick={() => setShowProcessForm(true)}><Plus className="w-4 h-4 mr-2" />Create First Process</Button>}
          </div>
        ) : (
          <div className="space-y-3">
            {processes.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Process header */}
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleExpanded(p.id)} className="text-slate-400 hover:text-slate-600 shrink-0">
                    {expanded[p.id] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{p.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">
                        {p.trigger_type === 'auto' ? '⚡ Auto' : '👆 Manual'}
                      </span>
                      {p.category && <span className="text-xs text-slate-400">{p.category}</span>}
                    </div>
                    {p.description && <p className="text-sm text-slate-500 mt-0.5 truncate">{p.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(p)} className="min-h-[36px] text-xs">
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditProcess(p); setShowProcessForm(true); }} className="min-h-[36px]">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteProcess(p)} className="min-h-[36px] text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Steps */}
                {expanded[p.id] && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Steps</p>
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => setShowStepForm({ processId: p.id })} className="gap-1 text-xs min-h-[36px]">
                          <Plus className="w-3 h-3" /> Add Step
                        </Button>
                      )}
                    </div>

                    {!steps[p.id] ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : steps[p.id].length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No steps yet. Add steps to this process.</p>
                    ) : (
                      <div className="space-y-2">
                        {steps[p.id].map((step, idx) => (
                          <div key={step.id} className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                              {step.step_order}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 text-sm">{step.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-400">👤 {step.assignee_name || step.assignee_email}</span>
                                <span className="text-xs text-slate-300">·</span>
                                <span className="text-xs text-slate-400">
                                  {step.tat_type === 'fixed_hours' ? `${step.tat_value}h` :
                                   step.tat_type === 'business_days' ? `${step.tat_value}d` :
                                   step.tat_type === 'end_of_day' ? 'End of day' :
                                   `At ${step.tat_time}`}
                                </span>
                                {step.completion_mode === 'auto' && (
                                  <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">auto</span>
                                )}
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex gap-1 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => setShowStepForm({ processId: p.id, step })} className="min-h-[36px]">
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteStep(step)} className="min-h-[36px] text-red-400 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showProcessForm && (
        <ProcessForm
          process={editProcess}
          onClose={() => { setShowProcessForm(false); setEditProcess(null); }}
          onSaved={() => { setShowProcessForm(false); setEditProcess(null); load(); }}
        />
      )}

      {showStepForm && (
        <StepForm
          step={showStepForm.step}
          processId={showStepForm.processId}
          nextOrder={(steps[showStepForm.processId]?.length || 0) + 1}
          users={users}
          onClose={() => setShowStepForm(null)}
          onSaved={() => {
            const pid = showStepForm.processId;
            setShowStepForm(null);
            // Refresh steps for this process only (not full page reload)
            base44.entities.FMSProcessStep.filter({ process_id: pid }, 'step_order', 100).then(s => {
              setSteps(prev => ({ ...prev, [pid]: s.sort((a, b) => a.step_order - b.step_order) }));
            });
          }}
        />
      )}
    </div>
  );
}