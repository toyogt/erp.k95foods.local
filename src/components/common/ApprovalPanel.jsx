/**
 * Approval Panel
 * Show approval rules and action buttons
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function ApprovalPanel({
  status = 'pending',
  currentUser,
  approvalRules,
  onApprove,
  onReject,
  loading = false,
}) {
  const [reason, setReason] = useState('');
  const [showReasonForm, setShowReasonForm] = useState(false);

  if (!approvalRules || approvalRules.length === 0) {
    return null;
  }

  const canApprove = approvalRules.some(rule =>
    rule.allowed_roles?.includes(currentUser?.role)
  );

  if (!canApprove) {
    return null;
  }

  // Show approval status
  if (status === 'approved') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <p className="text-green-700 font-medium">Approved</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
        <XCircle className="w-5 h-5 text-red-600" />
        <p className="text-red-700 font-medium">Rejected</p>
      </div>
    );
  }

  // Show pending approval
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-yellow-600" />
        <p className="font-medium text-yellow-900">Pending Approval</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {approvalRules.map(rule => (
          <Badge key={rule.id} variant="outline">
            {rule.action_label}
          </Badge>
        ))}
      </div>

      {showReasonForm && (
        <Textarea
          placeholder="Enter reason for approval/rejection..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="text-sm h-20"
        />
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowReasonForm(!showReasonForm)}
          disabled={loading}
          size="sm"
        >
          {showReasonForm ? 'Hide' : 'Add Reason'}
        </Button>

        <Button
          variant="outline"
          onClick={() => onReject?.(reason)}
          disabled={loading}
          size="sm"
          className="text-red-600 hover:text-red-700"
        >
          Reject
        </Button>

        <Button
          onClick={() => onApprove?.(reason)}
          disabled={loading}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          Approve
        </Button>
      </div>
    </div>
  );
}