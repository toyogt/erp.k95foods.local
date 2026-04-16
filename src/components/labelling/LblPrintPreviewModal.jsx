/**
 * LblPrintPreviewModal
 * Shows final POD values that will be sent to printer before confirming print.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function LblPrintPreviewModal({ open, onOpenChange, podValues, printerName, templateName, quantity, onConfirm, isLoading }) {
  if (!podValues) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Demo Print</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Printer & Template Info */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <p><span className="font-medium text-slate-700">Printer:</span> <span className="text-slate-900">{printerName}</span></p>
            <p><span className="font-medium text-slate-700">Template:</span> <span className="font-mono text-slate-900">{templateName}</span></p>
            <p><span className="font-medium text-slate-700">Quantity:</span> <span className="text-slate-900">{quantity} label(s)</span></p>
          </div>

          {/* POD Values Table */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Label Data to be Sent:</p>
            <table className="w-full text-sm border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left p-2 font-semibold text-slate-700">Field</th>
                  <th className="text-left p-2 font-semibold text-slate-700">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(podValues).map(([key, value]) => (
                  <tr key={key} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-mono text-slate-600">{key}</td>
                    <td className="p-2 text-slate-900">{value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warning */}
          <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Once sent, the printer middleware will process the label data. Verify the sample output before proceeding with bulk printing.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isLoading} className="gap-2 bg-purple-600 hover:bg-purple-700">
            {isLoading ? '⏳ Sending...' : '✓ Confirm & Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}