import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EscalateModal({ stepInstance, user, onDone, onClose }) {
  const [note, setNote] = useState('');
  const [escalationType, setEscalationType] = useState('reminder');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.EscalationLog.create({
        step_instance_id: stepInstance.id,
        process_instance_id: stepInstance.process_instance_id,
        process_name: stepInstance.process_name || '',
        step_name: stepInstance.step_name,
        assignee_email: stepInstance.assignee_email,
        assignee_name: stepInstance.assignee_name,
        escalated_by_email: user?.email || '',
        escalated_by_name: user?.full_name || '',
        note,
        escalation_type: escalationType,
      });
      await base44.entities.StepInstance.update(stepInstance.id, {
        escalation_sent: true,
        escalation_note: note,
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
          <DialogTitle>Escalate / Send Reminder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <p className="font-medium">{stepInstance.step_name}</p>
            <p className="text-slate-500 text-xs mt-1">Assigned to: {stepInstance.assignee_name || stepInstance.assignee_email}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Type</Label>
            <Select value={escalationType} onValueChange={setEscalationType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reminder">Reminder — friendly nudge</SelectItem>
                <SelectItem value="escalation">Escalation — urgent / overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Note</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} className="mt-1" rows={3}
              placeholder="Add context for the assignee…" />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="flex-1 min-h-[48px]">
              {saving ? 'Sending…' : escalationType === 'reminder' ? 'Send Reminder' : 'Escalate'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="min-h-[48px]">Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}