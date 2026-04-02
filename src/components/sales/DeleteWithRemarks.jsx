/**
 * Reusable Delete with Remarks modal for admin users.
 * Requires mandatory reason before deleting any record.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

export default function DeleteWithRemarks({ open, onClose, entityName, recordId, referenceNumber, onDeleted }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  async function handleDelete() {
    if (!reason.trim()) {
      toast({ title: 'Deletion reason is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    // Log the deletion in audit
    await base44.entities.SalesAuditLog.create({
      entity_type: entityName,
      entity_id: recordId,
      reference_number: referenceNumber || recordId,
      action: 'deleted',
      notes: reason.trim(),
      user_email: user?.email,
    });
    // Delete the record
    await base44.entities[entityName].delete(recordId);
    setSaving(false);
    toast({ title: `${entityName} deleted`, description: referenceNumber });
    setReason('');
    if (onDeleted) onDeleted();
    onClose();
  }

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" /> Delete {entityName.replace(/([A-Z])/g, ' $1').trim()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              You are about to permanently delete <strong>{referenceNumber || recordId}</strong>.
              This action cannot be undone.
            </p>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Reason for Deletion *</Label>
            <Input
              className="h-11 text-sm mt-1 border-red-300 focus:ring-red-500"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Enter mandatory reason for deletion..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="h-11 text-sm" onClick={onClose}>Cancel</Button>
            <Button
              className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm"
              onClick={handleDelete}
              disabled={saving || !reason.trim()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Confirm Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}