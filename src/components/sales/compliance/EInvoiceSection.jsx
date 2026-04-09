/**
 * E-Invoice info display + Generate / Cancel IRN buttons
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EInvoiceStatusBadge } from './ComplianceStatusBadges';
import { Zap, XCircle, Loader2, FileText } from 'lucide-react';

export default function EInvoiceSection({ invoice, onUpdated }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const einvStatus = invoice.einvoice_status || 'not_generated';
  const hasIRN = !!invoice.irn;

  async function generateIRN() {
    setLoading(true);
    const resp = await base44.functions.invoke('gstCompliance', {
      action: 'generate_irn', invoice_id: invoice.id,
    });
    setLoading(false);
    if (resp.data?.success) {
      toast({ title: 'E-Invoice (IRN) generated successfully' });
      onUpdated();
    } else {
      toast({ title: 'E-Invoice generation failed', description: resp.data?.error || 'Check API settings', variant: 'destructive' });
    }
  }

  async function cancelIRN() {
    if (!cancelReason.trim()) {
      toast({ title: 'Cancellation reason is required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const resp = await base44.functions.invoke('gstCompliance', {
      action: 'cancel_irn', invoice_id: invoice.id,
      cancel_reason: cancelReason, cancel_reason_code: '1',
    });
    setLoading(false);
    if (resp.data?.success) {
      toast({ title: 'E-Invoice cancelled successfully' });
      setShowCancel(false);
      setCancelReason('');
      onUpdated();
    } else {
      toast({ title: 'Cancellation failed', description: resp.data?.error || 'API error', variant: 'destructive' });
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <FileText className="w-4 h-4 text-violet-600" />
        <span className="text-sm font-semibold text-slate-900">E-Invoice (IRN)</span>
        <span className="ml-auto"><EInvoiceStatusBadge status={einvStatus} /></span>
      </div>

      <div className="p-4 space-y-3">
        {hasIRN && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
            <div className="text-sm">
              <span className="text-slate-500">IRN: </span>
              <span className="font-mono text-xs break-all text-slate-900">{invoice.irn}</span>
            </div>
            {invoice.ack_number && (
              <div className="text-sm">
                <span className="text-slate-500">Acknowledgement Number: </span>
                <span className="font-medium text-slate-900">{invoice.ack_number}</span>
              </div>
            )}
            {invoice.ack_date && (
              <div className="text-sm">
                <span className="text-slate-500">Acknowledgement Date: </span>
                <span className="font-medium text-slate-900">{invoice.ack_date}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {einvStatus !== 'generated' && (
            <Button className="h-11 text-sm bg-violet-700 hover:bg-violet-800 text-white"
              onClick={generateIRN} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Generate E-Invoice
            </Button>
          )}
          {einvStatus === 'generated' && !showCancel && (
            <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowCancel(true)} disabled={loading}>
              <XCircle className="w-4 h-4 mr-1" /> Cancel E-Invoice
            </Button>
          )}
        </div>

        {showCancel && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <Label className="text-xs font-medium text-red-700">Cancellation Reason *</Label>
            <Input className="h-9 text-sm border-red-300" value={cancelReason}
              onChange={e => setCancelReason(e.target.value)} placeholder="Enter reason for cancellation..." />
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 text-sm" onClick={() => { setShowCancel(false); setCancelReason(''); }}>Back</Button>
              <Button className="h-11 text-sm bg-red-600 hover:bg-red-700 text-white" onClick={cancelIRN} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                Confirm Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}