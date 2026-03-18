import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Clock, CheckCircle2, RefreshCw, User } from 'lucide-react';
import { isDelayed, formatDelay, getDelayMinutes, formatDue } from '@/lib/tatUtils';
import EscalateModal from '@/components/fms/EscalateModal';
import ReassignModal from '@/components/fms/ReassignModal';
import InstanceDetail from '@/components/fms/InstanceDetail';

export default function FMSMonitor() {
  const [activeSteps, setActiveSteps] = useState([]);
  const [instances, setInstances] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [escalateStep, setEscalateStep] = useState(null);
  const [reassignStep, setReassignStep] = useState(null);
  const [selectedInst, setSelectedInst] = useState(null);
  const [filterDelayed, setFilterDelayed] = useState(false);

  const load = async () => {
    const [steps, u] = await Promise.all([
      base44.entities.StepInstance.filter({ status: 'active' }),
      base44.auth.me(),
    ]);
    steps.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    setActiveSteps(steps);
    setUser(u);

    // load process instance names
    const ids = [...new Set(steps.map(s => s.process_instance_id))];
    const instMap = {};
    for (const id of ids) {
      const res = await base44.entities.ProcessInstance.filter({ id });
      if (res[0]) instMap[id] = res[0];
    }
    setInstances(instMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = user?.role === 'admin';
  const isPC = user?.role === 'pc' || isAdmin;

  if (!isPC) return (
    <div className="p-8 text-center text-slate-500">
      <p>Monitor is only available to Process Controllers and Admins.</p>
    </div>
  );

  const displayed = filterDelayed ? activeSteps.filter(s => isDelayed(s)) : activeSteps;
  const delayedCount = activeSteps.filter(s => isDelayed(s)).length;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Monitor</h1>
          <p className="text-sm text-slate-500">{activeSteps.length} active steps · {delayedCount} delayed</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filterDelayed ? 'default' : 'outline'} size="sm"
            onClick={() => setFilterDelayed(!filterDelayed)}
            className={`min-h-[44px] gap-1 ${filterDelayed ? 'bg-red-600 hover:bg-red-700' : ''}`}>
            <AlertTriangle className="w-4 h-4" />
            Delayed ({delayedCount})
          </Button>
          <Button variant="ghost" size="icon" className="w-10 h-10" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{activeSteps.length}</p>
          <p className="text-xs text-slate-500">Active Steps</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{delayedCount}</p>
          <p className="text-xs text-slate-500">Delayed</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-slate-700">
            {activeSteps.filter(s => !isDelayed(s)).length}
          </p>
          <p className="text-xs text-slate-500">On Track</p>
        </Card>
      </div>

      {displayed.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="font-medium">All clear</p>
          <p className="text-sm">{filterDelayed ? 'No delayed steps.' : 'No active steps.'}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayed.map(s => {
            const delayed = isDelayed(s);
            const inst = instances[s.process_instance_id];
            return (
              <Card key={s.id} className={`p-4 border-l-4 ${delayed ? 'border-l-red-500 bg-red-50/30' : 'border-l-blue-400'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{s.step_name}</span>
                      {delayed && (
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{formatDelay(getDelayMinutes(s))}
                        </span>
                      )}
                    </div>
                    <button className="text-xs text-blue-600 hover:underline mt-0.5 text-left"
                      onClick={() => inst && setSelectedInst(inst)}>
                      {inst?.title || s.process_instance_id}
                    </button>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      {s.assignee_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.assignee_name}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{formatDue(s.due_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline"
                      className="min-h-[44px] text-orange-600 border-orange-300 text-xs"
                      onClick={() => setEscalateStep(s)}>
                      Escalate
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-[44px] text-xs"
                      onClick={() => setReassignStep(s)}>
                      Reassign
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {escalateStep && (
        <EscalateModal stepInstance={escalateStep} user={user}
          onDone={() => { setEscalateStep(null); load(); }}
          onClose={() => setEscalateStep(null)} />
      )}
      {reassignStep && (
        <ReassignModal stepInstance={reassignStep}
          onDone={() => { setReassignStep(null); load(); }}
          onClose={() => setReassignStep(null)} />
      )}
      {selectedInst && (
        <Dialog open onOpenChange={() => setSelectedInst(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Process Detail</DialogTitle></DialogHeader>
            <InstanceDetail instance={selectedInst} user={user} onUpdate={load} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}