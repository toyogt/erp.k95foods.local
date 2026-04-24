/**
 * E-Invoice info display + Generate / Cancel IRN buttons
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EInvoiceStatusBadge } from './ComplianceStatusBadges';
import { Zap, XCircle, Loader2, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

export default function EInvoiceSection({ invoice, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const einvStatus = invoice.einvoice_status || 'not_generated';
  const hasIRN = !!invoice.irn;

  async function generateIRN() {
    const confirm = await Swal.fire({
      title: 'Generate E-Invoice?',
      text: `This will generate IRN for invoice ${invoice.invoice_number} via the government portal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      confirmButtonText: 'Yes, Generate',
      cancelButtonText: 'Cancel',
    });
    if (!confirm.isConfirmed) return;

    setLoading(true);
    Swal.fire({ title: 'Generating E-Invoice...', text: 'Connecting to government portal via Adaequare GSP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const resp = await base44.functions.invoke('gstCompliance', {
      action: 'generate_irn', invoice_id: invoice.id,
    });
    setLoading(false);

    if (resp.data?.success) {
      const modeTag = resp.data.mode === 'sandbox' ? ' <span style="color:#b45309;font-weight:600">(Sandbox Mode)</span>' : '';
      Swal.fire({ icon: 'success', title: 'E-Invoice Generated!', html: `<div class="text-left text-sm"><p><b>IRN:</b> <span style="word-break:break-all;font-family:monospace;font-size:11px">${resp.data.irn || ''}</span></p><p><b>Acknowledgement Number:</b> ${resp.data.ack_number || ''}</p><p><b>Acknowledgement Date:</b> ${resp.data.ack_date || ''}</p>${modeTag}</div>`, confirmButtonColor: '#16a34a' });
      onUpdated();
    } else {
      const errCode = resp.data?.error_code ? ` [${resp.data.error_code}]` : '';
      Swal.fire({ icon: 'error', title: 'E-Invoice Generation Failed', html: `<div class="text-left text-sm"><p>${resp.data?.error || 'Check API settings and try again.'}${errCode}</p></div>`, confirmButtonColor: '#dc2626' });
    }
  }

  async function cancelIRN() {
    if (!cancelReason.trim()) {
      Swal.fire({ icon: 'warning', title: 'Reason Required', text: 'Please enter a cancellation reason.', confirmButtonColor: '#dc2626' });
      return;
    }
    const confirm = await Swal.fire({
      title: 'Cancel E-Invoice?',
      text: 'This action will cancel the IRN on the government portal. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Cancel IRN',
      cancelButtonText: 'Go Back',
    });
    if (!confirm.isConfirmed) return;

    setLoading(true);
    Swal.fire({ title: 'Cancelling E-Invoice...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const resp = await base44.functions.invoke('gstCompliance', {
      action: 'cancel_irn', invoice_id: invoice.id,
      cancel_reason: cancelReason, cancel_reason_code: '1',
    });
    setLoading(false);

    if (resp.data?.success) {
      Swal.fire({ icon: 'success', title: 'E-Invoice Cancelled', confirmButtonColor: '#16a34a' });
      setShowCancel(false);
      setCancelReason('');
      onUpdated();
    } else {
      Swal.fire({ icon: 'error', title: 'Cancellation Failed', text: resp.data?.error || 'API error', confirmButtonColor: '#dc2626' });
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