import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Clock, AlertTriangle, Play, ListChecks, BarChart3 } from 'lucide-react';
import { formatDue, isDelayed, formatDelay, getDelayMinutes } from '@/lib/tatUtils';
import InstanceDetail from '@/components/fms/InstanceDetail';
import StartInstanceForm from '@/components/fms/StartInstanceForm';

export default function FMSDashboard() {
  const [user, setUser] = useState(null);
  const [mySteps, setMySteps] = useState([]);
  const [instances, setInstances] = useState({});
  const [stats, setStats] = useState({ active: 0, completed_today: 0, delayed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [showStart, setShowStart] = useState(false);

  const load = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const isAdmin = u?.role === 'admin';
    const isPC = u?.role === 'pc' || isAdmin;

    // Active step instances for this user (or all for admin/pc)
    const allActive = await base44.entities.StepInstance.filter({ status: 'active' });
    const mine = isPC ? allActive : allActive.filter(s => s.assignee_email === u?.email);
    mine.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    setMySteps(mine);

    // Load related process instances
    const instMap = {};
    const uniqueInstanceIds = [...new Set(mine.map(s => s.process_instance_id))];
    for (const id of uniqueInstanceIds) {
      const res = await base44.entities.ProcessInstance.filter({ id });
      if (res[0]) instMap[id] = res[0];
    }
    setInstances(instMap);

    // Stats
    const allInstances = await base44.entities.ProcessInstance.filter({ status: 'active' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const completedToday = (await base44.entities.ProcessInstance.filter({ status: 'completed' }))
      .filter(i => i.completed_at && new Date(i.completed_at) >= today).length;
    const delayed = allActive.filter(s => isDelayed(s)).length;
    setStats({ active: allInstances.length, completed_today: completedToday, delayed });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = user?.role === 'admin';
  const isDesigner = user?.role === 'designer' || isAdmin;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Flow Management</h1>
          <p className="text-sm text-slate-500">Hi {user?.full_name?.split(' ')[0] || 'there'} — your active tasks</p>
        </div>
        {isDesigner && (
          <Button onClick={() => setShowStart(true)} className="min-h-[48px] gap-2">
            <Play className="w-4 h-4" /> Start Process
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Runs', value: stats.active, icon: BarChart3, color: 'text-blue-600' },
          { label: 'Done Today', value: stats.completed_today, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Delayed', value: stats.delayed, icon: AlertTriangle, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* My pending steps */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ListChecks className="w-4 h-4" />
          {user?.role === 'admin' || user?.role === 'pc' ? 'All Active Steps' : 'My Pending Tasks'}
          <Badge className="bg-slate-100 text-slate-600 text-xs">{mySteps.length}</Badge>
        </h2>
        {mySteps.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="font-medium">All clear!</p>
            <p className="text-sm">No pending tasks right now.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {mySteps.map(s => {
              const delayed = isDelayed(s);
              const inst = instances[s.process_instance_id];
              return (
                <Card key={s.id}
                  className={`p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${delayed ? 'border-l-red-500' : 'border-l-blue-500'}`}
                  onClick={() => inst && setSelectedInstance(inst)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.step_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{inst?.title || s.process_instance_id}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {delayed ? (
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{formatDelay(getDelayMinutes(s))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDue(s.due_at)}
                        </span>
                      )}
                      {s.assignee_name && <p className="text-xs text-slate-400 mt-0.5">{s.assignee_name}</p>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/FMSActiveRuns">
          <Card className="p-4 text-center hover:shadow-md transition-all cursor-pointer">
            <BarChart3 className="w-6 h-6 mx-auto mb-1 text-blue-600" />
            <p className="text-sm font-medium">Active Runs</p>
          </Card>
        </Link>
        {(isAdmin || user?.role === 'designer') && (
          <Link to="/FMSProcesses">
            <Card className="p-4 text-center hover:shadow-md transition-all cursor-pointer">
              <ListChecks className="w-6 h-6 mx-auto mb-1 text-purple-600" />
              <p className="text-sm font-medium">Processes</p>
            </Card>
          </Link>
        )}
      </div>

      {/* Instance detail drawer */}
      {selectedInstance && (
        <Dialog open onOpenChange={() => setSelectedInstance(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Process Detail</DialogTitle>
            </DialogHeader>
            <InstanceDetail instance={selectedInstance} user={user} onUpdate={load} />
          </DialogContent>
        </Dialog>
      )}

      {/* Start process */}
      {showStart && (
        <Dialog open onOpenChange={() => setShowStart(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Start a Process</DialogTitle>
            </DialogHeader>
            <StartInstanceForm
              onStarted={(inst) => { setShowStart(false); setSelectedInstance(inst); load(); }}
              onCancel={() => setShowStart(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}