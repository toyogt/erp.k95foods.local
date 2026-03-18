import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ReassignModal({ stepInstance, onDone, onClose }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState(stepInstance.assignee_email || '');
  const [name, setName] = useState(stepInstance.assignee_name || '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.User.list().then(setUsers).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.StepInstance.update(stepInstance.id, {
        assignee_email: email,
        assignee_name: name,
        escalation_note: reason ? `Reassigned: ${reason}` : 'Reassigned',
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Step</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <p className="font-medium">{stepInstance.step_name}</p>
            <p className="text-slate-500 text-xs mt-1">Currently: {stepInstance.assignee_name || stepInstance.assignee_email || 'Unassigned'}</p>
          </div>
          {users.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Pick from users</Label>
              <div className="mt-1 max-h-36 overflow-y-auto border rounded-lg divide-y">
                {users.map(u => (
                  <button key={u.id} type="button"
                    onClick={() => { setEmail(u.email); setName(u.full_name); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${email === u.email ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}>
                    {u.full_name} <span className="text-slate-400 text-xs">{u.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Email *</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} className="mt-1" type="email" required />
            </div>
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Reason (optional)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} className="mt-1" rows={2} />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="flex-1 min-h-[48px]">
              {saving ? 'Saving…' : 'Reassign'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="min-h-[48px]">Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}