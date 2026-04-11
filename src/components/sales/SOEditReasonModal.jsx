/**
 * Modal that requires a reason before confirming an edit or deletion on Sales Order items.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function SOEditReasonModal({ changes, isDelete, onConfirm, onCancel, saving }) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className={`px-5 py-4 border-b ${isDelete ? 'border-red-100 bg-red-50' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isDelete ? 'text-red-500' : 'text-amber-500'}`} />
            <h3 className={`text-sm font-semibold ${isDelete ? 'text-red-900' : 'text-slate-900'}`}>
              {isDelete ? 'Confirm Deletion' : 'Confirm Changes'}
            </h3>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Changes being made:</p>
            {changes.map((c, i) => (
              <p key={i} className="text-sm text-slate-800 bg-slate-50 px-3 py-1.5 rounded-md">• {c}</p>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Reason for Change *</label>
            <Input
              className="h-11 md:h-9 text-sm mt-1"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Enter reason for this change..."
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">This will be logged in the audit trail</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Button variant="outline" className="h-11 md:h-9 text-sm" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button
            className={`h-11 md:h-9 text-sm text-white ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
            onClick={handleConfirm}
            disabled={!reason.trim() || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {isDelete ? 'Delete with Reason' : 'Confirm Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}