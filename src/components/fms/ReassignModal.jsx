import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

export default function ReassignModal({ stepInstance, users, onClose, onDone }) {
  const [newEmail, setNewEmail] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!newEmail) return;
    setSaving(true);
    await base44.functions.invoke('fmsTriggerProcess', {
      action: 'reassign',
      step_instance_id: stepInstance.id,
      new_assignee_email: newEmail,
      new_assignee_name: users?.find(u => u.email === newEmail)?.full_name || newEmail,
      reason,
    });
    setSaving(false);
    onDone();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reassign Step</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">Step: <strong>{stepInstance.step_name}</strong></p>
          <p className="text-sm text-slate-500">Currently assigned to: {stepInstance.assignee_name || stepInstance.assignee_email}</p>

          <div>
            <Label>New Assignee</Label>
            {users && users.length > 0 ? (
              <Select value={newEmail} onValueChange={setNewEmail}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@company.com" className="mt-1" />
            )}
          </div>

          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you reassigning this step?" className="mt-1 h-16" />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !newEmail} className="min-h-[44px]">
              {saving ? 'Saving…' : 'Reassign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}