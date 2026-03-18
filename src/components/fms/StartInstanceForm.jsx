import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StartInstanceForm({ onStarted, onCancel }) {
  const [processes, setProcesses] = useState([]);
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Process.filter({ is_active: true }),
      base44.auth.me(),
    ]).then(([procs, u]) => {
      setProcesses(procs.filter(p => p.trigger_type === 'manual'));
      setUser(u);
      setLoading(false);
    });
  }, []);

  const selectedProcess = processes.find(p => p.id === selectedProcessId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProcessId) return;
    setStarting(true);
    try {
      const steps = await base44.entities.ProcessStep.filter({ process_id: selectedProcessId });
      steps.sort((a, b) => a.step_number - b.step_number);
      const now = new Date();

      const instance = await base44.entities.ProcessInstance.create({
        process_id: selectedProcessId,
        process_name: selectedProcess.name,
        title: title || `${selectedProcess.name} — ${now.toLocaleDateString('en-IN')}`,
        status: 'active',
        trigger_type: 'manual',
        trigger_source: 'FactoryFlow',
        current_step_number: 1,
        started_at: now.toISOString(),
        started_by_email: user?.email || '',
        started_by_name: user?.full_name || '',
        notes,
      });

      let prevTime = now;
      for (const step of steps) {
        const dueAt = calcDue(prevTime, step);
        const isFirst = step.step_number === 1;
        await base44.entities.StepInstance.create({
          process_instance_id: instance.id,
          process_id: selectedProcessId,
          step_id: step.id,
          step_number: step.step_number,
          step_name: step.name,
          assignee_email: step.assignee_email,
          assignee_name: step.assignee_name,
          status: isFirst ? 'active' : 'pending',
          due_at: dueAt.toISOString(),
          started_at: isFirst ? now.toISOString() : null,
          completion_type: step.completion_type,
        });
        prevTime = dueAt;
      }
      onStarted(instance);
    } finally {
      setStarting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Select Process *</Label>
        {loading ? (
          <p className="text-sm text-slate-500 mt-1">Loading processes…</p>
        ) : (
          <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a process to start" />
            </SelectTrigger>
            <SelectContent>
              {processes.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selectedProcess && (
        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{selectedProcess.description}</p>
      )}
      <div>
        <Label className="text-sm font-medium">Instance Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1"
          placeholder={selectedProcess ? `${selectedProcess.name} — ${new Date().toLocaleDateString('en-IN')}` : 'Auto-generated if blank'} />
      </div>
      <div>
        <Label className="text-sm font-medium">Notes (optional)</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={starting || !selectedProcessId} className="flex-1 min-h-[48px]">
          {starting ? 'Starting…' : 'Start Process'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-[48px]">Cancel</Button>
      </div>
    </form>
  );
}

function calcDue(fromDate, step) {
  const from = new Date(fromDate);
  switch (step.tat_type) {
    case 'fixed_hours': return new Date(from.getTime() + (step.tat_hours || 1) * 60 * 60 * 1000);
    case 'end_of_day': { const [h, m] = (step.tat_eod_time || '18:00').split(':').map(Number); const eod = new Date(from); eod.setHours(h, m, 0, 0); if (eod <= from) eod.setDate(eod.getDate() + 1); return eod; }
    case 'fixed_time': { const [h, m] = (step.tat_fixed_time || '17:00').split(':').map(Number); const ft = new Date(from); ft.setHours(h, m, 0, 0); if (ft <= from) ft.setDate(ft.getDate() + 1); return ft; }
    case 'business_days': { const days = step.tat_business_days || 1; let d = new Date(from); let added = 0; while (added < days) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) added++; } return d; }
    default: return new Date(from.getTime() + 2 * 60 * 60 * 1000);
  }
}