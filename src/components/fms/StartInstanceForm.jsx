import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';

export default function StartInstanceForm({ process, onClose, onStarted }) {
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState({});
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const triggerFields = process?.trigger_fields || [];

  const setField = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const start = async () => {
    setError('');
    // Validate required fields
    for (const tf of triggerFields) {
      if (tf.required && !fields[tf.key]) {
        setError(`"${tf.label}" is required`);
        return;
      }
    }
    setStarting(true);
    const res = await base44.functions.invoke('fmsTriggerProcess', {
      action: 'trigger',
      process_id: process.id,
      trigger_data: { ...fields, notes },
      title: title || `${process.name} — ${new Date().toLocaleDateString('en-IN')}`,
      trigger_source: 'manual',
    });
    setStarting(false);
    if (res.data?.success) {
      onStarted(res.data.instance_id);
    } else {
      setError(res.data?.error || 'Failed to start process');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start: {process.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Instance Title (optional)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${process.name} — ${new Date().toLocaleDateString('en-IN')}`} className="mt-1" />
          </div>

          {triggerFields.map(tf => (
            <div key={tf.key}>
              <Label>{tf.label}{tf.required && ' *'}</Label>
              {tf.type === 'select' && tf.options ? (
                <select
                  value={fields[tf.key] || ''}
                  onChange={e => setField(tf.key, e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select…</option>
                  {tf.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <Input
                  type={tf.type === 'number' ? 'number' : tf.type === 'date' ? 'date' : 'text'}
                  value={fields[tf.key] || ''}
                  onChange={e => setField(tf.key, e.target.value)}
                  className="mt-1"
                />
              )}
            </div>
          ))}

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional context..." className="mt-1 h-20" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={start} disabled={starting} className="min-w-[120px] min-h-[44px]">
              {starting ? 'Starting…' : '▶ Start Process'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}