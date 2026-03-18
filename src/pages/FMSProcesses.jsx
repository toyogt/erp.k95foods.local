import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ChevronRight, Zap, Hand, Pencil, Power } from 'lucide-react';
import ProcessForm from '@/components/fms/ProcessForm';

export default function FMSProcesses() {
  const [processes, setProcesses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProcess, setEditProcess] = useState(null);

  const load = async () => {
    const [procs, u] = await Promise.all([
      base44.entities.Process.list('-created_date', 100),
      base44.auth.me(),
    ]);
    setProcesses(procs);
    setUser(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = user?.role === 'admin';
  const isDesigner = user?.role === 'designer' || isAdmin;

  if (!isDesigner) return (
    <div className="p-8 text-center text-slate-500">
      <p>You don't have permission to manage processes.</p>
    </div>
  );

  const toggleActive = async (p) => {
    await base44.entities.Process.update(p.id, { is_active: !p.is_active });
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Processes</h1>
        <Button onClick={() => { setEditProcess(null); setShowForm(true); }} className="gap-2 min-h-[48px]">
          <Plus className="w-4 h-4" /> New Process
        </Button>
      </div>

      {processes.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <p className="font-medium">No processes yet</p>
          <p className="text-sm mt-1">Create your first process to get started.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {processes.map(p => (
            <Card key={p.id} className={`p-4 ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{p.name}</span>
                    {p.category && <Badge className="bg-purple-100 text-purple-700 border-purple-200 border text-xs">{p.category}</Badge>}
                    <Badge className={`border text-xs ${p.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {p.trigger_type === 'auto'
                      ? <Zap className="w-3.5 h-3.5 text-yellow-500" title="Auto-triggered" />
                      : <Hand className="w-3.5 h-3.5 text-slate-400" title="Manual" />}
                  </div>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="icon" variant="ghost" className="w-9 h-9" onClick={() => { setEditProcess(p); setShowForm(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-9 h-9" onClick={() => toggleActive(p)}
                    title={p.is_active ? 'Deactivate' : 'Activate'}>
                    <Power className={`w-4 h-4 ${p.is_active ? 'text-green-600' : 'text-slate-400'}`} />
                  </Button>
                  <Link to={`/FMSProcessSteps/${p.id}`}>
                    <Button size="icon" variant="ghost" className="w-9 h-9">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editProcess ? 'Edit Process' : 'New Process'}</DialogTitle>
            </DialogHeader>
            <ProcessForm process={editProcess} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}