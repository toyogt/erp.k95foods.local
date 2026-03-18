import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { formatDeadline } from '@/lib/fmsHelpers';

export default function EscalateModal({ stepInstance, onClose, onDone }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    await base44.functions.invoke('fmsTriggerProcess', {
      action: 'send_reminder',
      step_instance_id: stepInstance.id,
      message: message || undefined,
    });
    setSending(false);
    onDone();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-slate-500">Step:</span> <strong>{stepInstance.step_name}</strong></p>
            <p><span className="text-slate-500">Assignee:</span> {stepInstance.assignee_name || stepInstance.assignee_email}</p>
            <p><span className="text-slate-500">Deadline:</span> {formatDeadline(stepInstance.deadline)}</p>
          </div>

          <div>
            <Label>Message (optional)</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Custom reminder message… or leave blank for default"
              className="mt-1 h-24"
            />
          </div>
          <p className="text-xs text-slate-400">An email will be sent to {stepInstance.assignee_email}</p>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={send} disabled={sending} className="min-h-[44px]">
              {sending ? 'Sending…' : '📩 Send Reminder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}