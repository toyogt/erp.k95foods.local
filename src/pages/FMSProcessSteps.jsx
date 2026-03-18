import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ChevronLeft, User, Clock } from 'lucide-react';
import StepForm from '@/components/fms/StepForm';
import { tatLabel } from '@/lib/tatUtils';

export default function FMSProcessSteps() {
  const { processId } = useParams();
  const [process, setProcess] = useState(null);
  const [steps, setSteps] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editStep, setEditStep] = useState(null);

  const load = async () => {
    const [procs, stps, u] = await Promise.all([
      base44.entities.Process.filter({ id: processId }),
      base44.entities.ProcessStep.filter({ process_id: processId }),
      base44.auth.me(),
    ]);
    setProcess(procs[0]);
    stps.sort((a, b) => a.step_number - b.step_number);
    setSteps(stps);
    setUser(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, [processId]);

  const isAdmin = user?.role === 'admin';
  const isDesigner = user?.role === 'designer' || isAdmin;

  const handleDelete = async (step) => {
    if (!confirm(`Delete step "${step.name}"?`)) return;
    await base44.entities.ProcessStep.delete(step.id);
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/FMSProcesses">
          <Button variant="ghost" size="icon" className="w-10 h-10"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{process?.name || 'Process Steps'}</h1>
          {process?.description && <p className="text-sm text-slate-500 truncate">{process.description}</p>}
        </div>
        {isDesigner && (
          <Button onClick={() => { setEditStep(null); setShowForm(true); }} className="gap-2 min-h-[48px]">
            <Plus className="w-4 h-4" /> Add Step
          </Button>
        )}
      </div>

      {steps.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <p className="font-medium">No steps defined yet</p>
          <p className="text-sm mt-1">Add steps to define the workflow.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {steps.map((s, idx) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {s.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {s.assignee_name && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="w-3 h-3" />{s.assignee_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />TAT: {tatLabel(s)}
                    </span>
                    <Badge className={`border text-xs ${s.completion_type === 'auto' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {s.completion_type}
                    </Badge>
                  </div>
                </div>
                {isDesigner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="w-9 h-9" onClick={() => { setEditStep(s); setShowForm(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-9 h-9 text-red-500 hover:text-red-700" onClick={() => handleDelete(s)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className="ml-4 mt-2 w-0.5 h-3 bg-slate-300" />
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editStep ? 'Edit Step' : 'Add Step'}</DialogTitle>
            </DialogHeader>
            <StepForm step={editStep} processId={processId} nextStepNumber={steps.length + 1}
              onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}