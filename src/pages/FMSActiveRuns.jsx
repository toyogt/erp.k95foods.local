import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Search, Clock, CheckCircle2, XCircle, PauseCircle } from 'lucide-react';
import StartInstanceForm from '@/components/fms/StartInstanceForm';
import InstanceDetail from '@/components/fms/InstanceDetail';

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  on_hold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const STATUS_ICONS = {
  active: Clock,
  completed: CheckCircle2,
  cancelled: XCircle,
  on_hold: PauseCircle,
};

export default function FMSActiveRuns() {
  const [instances, setInstances] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showStart, setShowStart] = useState(false);

  const load = async () => {
    const [insts, u] = await Promise.all([
      base44.entities.ProcessInstance.list('-started_at', 200),
      base44.auth.me(),
    ]);
    setInstances(insts);
    setUser(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = user?.role === 'admin';
  const isDesigner = user?.role === 'designer' || isAdmin;

  const handleCancel = async (inst) => {
    if (!confirm('Cancel this process instance?')) return;
    await base44.entities.ProcessInstance.update(inst.id, { status: 'cancelled' });
    load();
  };

  const filtered = instances.filter(i => {
    const matchStatus = filter === 'all' || i.status === filter;
    const matchSearch = !search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.process_name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Active Runs</h1>
        {isDesigner && (
          <Button onClick={() => setShowStart(true)} className="gap-2 min-h-[48px]">
            <Play className="w-4 h-4" /> Start
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <p className="font-medium">No instances found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(inst => {
            const Icon = STATUS_ICONS[inst.status] || Clock;
            return (
              <Card key={inst.id} className="p-4 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setSelected(inst)}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${
                    inst.status === 'active' ? 'text-blue-600' :
                    inst.status === 'completed' ? 'text-green-600' :
                    inst.status === 'cancelled' ? 'text-red-500' : 'text-yellow-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{inst.title}</span>
                      <Badge className={`${STATUS_COLORS[inst.status]} border text-xs`}>{inst.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{inst.process_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      <span>Step {inst.current_step_number}</span>
                      <span>Started {new Date(inst.started_at).toLocaleDateString('en-IN')}</span>
                      {inst.started_by_name && <span>by {inst.started_by_name}</span>}
                    </div>
                  </div>
                  {isAdmin && inst.status === 'active' && (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 shrink-0 min-h-[44px]"
                      onClick={e => { e.stopPropagation(); handleCancel(inst); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Process Instance</DialogTitle>
            </DialogHeader>
            <InstanceDetail instance={selected} user={user} onUpdate={load} />
          </DialogContent>
        </Dialog>
      )}

      {showStart && (
        <Dialog open onOpenChange={() => setShowStart(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Start a Process</DialogTitle>
            </DialogHeader>
            <StartInstanceForm
              onStarted={(inst) => { setShowStart(false); setSelected(inst); load(); }}
              onCancel={() => setShowStart(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}