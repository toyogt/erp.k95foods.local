/**
 * Rule Block Dialog
 * Shows validation blocks and allows override by authorized users
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Lock, CheckCircle2 } from 'lucide-react';
import { canOverrideRule, getOverrideReasons, recordOverride } from '@/lib/rulesEngine';
import { base44 } from '@/api/base44Client';

export default function RuleBlockDialog({
  isOpen,
  blocks,
  warnings,
  user,
  onDismiss,
  onOverride,
  attemptId,
}) {
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideComment, setOverrideComment] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  if (!blocks || blocks.length === 0) return null;

  const block = blocks[selectedBlock];
  const canOverride = block.allowOverride && 
    (block.overrideRoles.includes(user?.role) || user?.role === 'admin');

  const handleOverride = async () => {
    if (!overrideReason) {
      alert('Please select a reason for override');
      return;
    }

    setOverrideLoading(true);
    try {
      // Record override in audit
      await recordOverride(attemptId, {
        supervisorEmail: user.email,
        supervisorName: user.full_name,
        reasonCode: overrideReason,
        comment: overrideComment,
      });

      // Notify parent
      if (onOverride) {
        await onOverride({
          ruleKey: block.ruleKey,
          reasonCode: overrideReason,
          comment: overrideComment,
        });
      }

      onDismiss();
    } catch (error) {
      alert('Failed to record override: ' + error.message);
    } finally {
      setOverrideLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDismiss}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Action Blocked by Validation Rule
          </DialogTitle>
          <DialogDescription>
            {blocks.length === 1
              ? 'This action violates a business rule.'
              : `${blocks.length} validation rules blocked this action. Review below.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Block selector (if multiple) */}
          {blocks.length > 1 && (
            <div className="flex gap-2">
              {blocks.map((b, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedBlock(idx)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedBlock === idx
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Block {idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Current block details */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-slate-900">{block.ruleName}</h4>
              <p className="text-sm text-slate-600 mt-1">{block.errorMessage}</p>
            </div>

            {/* Technical details */}
            {block.validationDetails && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-600">
                  Technical Details
                </summary>
                <pre className="mt-2 bg-white p-2 rounded border border-red-100 overflow-auto max-h-40">
                  {JSON.stringify(block.validationDetails, null, 2)}
                </pre>
              </details>
            )}
          </div>

          {/* Override section */}
          {canOverride ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                Supervisor Override
              </h4>
              <p className="text-sm text-slate-600">
                You have authorization to override this rule. Provide a reason below.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Override Reason Code *
                  </label>
                  <Select value={overrideReason} onValueChange={setOverrideReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {block.reasonCodes.map(code => (
                        <SelectItem key={code.code} value={code.code}>
                          {code.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Additional Comment (Optional)
                  </label>
                  <Textarea
                    placeholder="Explain the reason for this override..."
                    value={overrideComment}
                    onChange={e => setOverrideComment(e.target.value)}
                    className="h-20 text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Recorded with your name for audit purposes.
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={onDismiss} disabled={overrideLoading}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleOverride}
                    disabled={!overrideReason || overrideLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {overrideLoading ? 'Recording...' : 'Override & Proceed'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-700 font-medium">
                ⛔ You don't have permission to override this rule.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Contact a supervisor or production manager for authorization.
              </p>
            </div>
          )}

          {/* Warnings (informational) */}
          {warnings && warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
              <h5 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                Warnings (for awareness)
              </h5>
              {warnings.map((w, idx) => (
                <p key={idx} className="text-xs text-slate-600">
                  • {w.ruleName}: {w.errorMessage}
                </p>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}