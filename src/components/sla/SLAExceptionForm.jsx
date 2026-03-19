/**
 * SLA Exception Form
 * Allows users to justify delays with notes
 */

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function SLAExceptionForm({
  entityId,
  entityType,
  workflowType,
  onSuccess,
  onCancel,
}) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!notes.trim()) {
      setError('Please provide justification notes');
      return;
    }

    if (!reason.trim()) {
      setError('Please select a reason');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create exception record
      const exception = await base44.entities.SLAException.create({
        entity_id: entityId,
        entity_type: entityType,
        workflow_type: workflowType,
        reason_code: reason,
        justification_notes: notes,
        submitted_by: await base44.auth.me(),
        submitted_at: new Date().toISOString(),
      });

      onSuccess?.(exception);
    } catch (err) {
      setError(err.message || 'Failed to submit exception');
    } finally {
      setLoading(false);
    }
  };

  const reasons = [
    { code: 'waiting_external', label: 'Waiting for external party' },
    { code: 'missing_info', label: 'Missing required information' },
    { code: 'quality_hold', label: 'Quality/compliance issue under review' },
    { code: 'system_issue', label: 'System issue preventing progress' },
    { code: 'resource_constraint', label: 'Resource unavailable' },
    { code: 'other', label: 'Other (explain in notes)' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Justify Delay</p>
          <p className="mt-1">Provide a reason for this approval being delayed. This helps track legitimate blockers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Reason selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Reason for Delay *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm"
          >
            <option value="">Select a reason...</option>
            {reasons.map(r => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Justification Notes *
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain why this approval is delayed and when it's expected to be resolved..."
            className="w-full h-24 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <p className="text-xs text-slate-500 mt-1">
            {notes.length}/500 characters
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 border border-slate-200 rounded-lg font-medium text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Submitting...' : 'Submit Exception'}
          </Button>
        </div>
      </form>
    </div>
  );
}