/**
 * Action Footer
 * Submit, Save, Cancel, Delete buttons
 */

import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Save, X } from 'lucide-react';

export default function ActionFooter({
  onSubmit,
  onCancel,
  onDelete = null,
  submitLabel = 'Submit',
  loading = false,
  disabled = false,
  showDelete = false,
  variant = 'default', // 'default', 'compact'
}) {
  if (variant === 'compact') {
    return (
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading} size="sm">
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        )}
        <Button onClick={onSubmit} disabled={loading || disabled} size="sm">
          {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed md:static bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 md:p-0 md:border-0 md:mt-6 flex gap-3 justify-end">
      {showDelete && onDelete && (
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={loading}
          className="mr-auto"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      )}

      {onCancel && (
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="h-11 px-4"
        >
          Cancel
        </Button>
      )}

      <Button
        onClick={onSubmit}
        disabled={loading || disabled}
        className="h-11 px-4 bg-slate-900 hover:bg-slate-800"
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}