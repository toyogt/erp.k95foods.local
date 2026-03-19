/**
 * Audit Log Form Component
 * Captures reason code and notes for critical actions
 */

import { useState } from 'react';
import { getReasonCodesForAction, isReasonCodeMandatory } from '@/lib/reasonCodeRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AuditLogForm({
  actionType,
  entityType,
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [error, setError] = useState(null);

  const isMandatory = isReasonCodeMandatory(actionType, entityType);
  const reasonCodes = getReasonCodesForAction(actionType);

  const handleSubmit = () => {
    setError(null);

    if (isMandatory && !reasonCode && !reasonText) {
      setError('Reason code or note required for this action');
      return;
    }

    onSubmit({
      reasonCode: reasonCode || null,
      reasonText: reasonText || null,
    });
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div>
        <label className="text-sm font-medium text-slate-700">
          Reason Code {isMandatory && <span className="text-red-600">*</span>}
        </label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          className="w-full h-11 mt-1 border border-slate-200 rounded-md px-3 text-base bg-white"
        >
          <option value="">Select a reason...</option>
          {Object.values(reasonCodes).map((code) => (
            <option key={code.key} value={code.key}>
              {code.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">Select the primary reason for this action</p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Additional Notes {isMandatory && reasonCode && <span className="text-red-600">*</span>}
        </label>
        <textarea
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="Provide context for this action..."
          rows={3}
          className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-base bg-white"
        />
        <p className="text-xs text-slate-500 mt-1">
          {isMandatory
            ? 'Note: This action requires either a reason code or detailed notes for audit trail'
            : 'Optional: Help explain the context of this action'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="h-11 text-base"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="h-11 text-base"
        >
          {loading ? 'Processing...' : 'Confirm & Complete'}
        </Button>
      </div>
    </div>
  );
}