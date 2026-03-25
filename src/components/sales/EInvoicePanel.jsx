/**
 * E-Invoice & E-Way Bill Panel
 * Placeholder for ClearTax API integration + Push to Tally
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Truck, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function EInvoicePanel({ invoice, order }) {
  const { toast } = useToast();
  const [irn, setIrn] = useState(invoice?.irn || '');
  const [ackNo, setAckNo] = useState(invoice?.ack_number || '');
  const [ewayBill, setEwayBill] = useState(invoice?.eway_bill || '');

  const hasEInvoice = !!invoice?.irn;
  const hasEwayBill = !!invoice?.eway_bill;

  function handleGenerateEInvoice() {
    toast({
      title: 'ClearTax API not configured yet',
      description: 'Please set the CLEARTAX_API_KEY in app settings to enable E-Invoice generation.',
      variant: 'destructive',
    });
  }

  function handleGenerateEwayBill() {
    toast({
      title: 'ClearTax API not configured yet',
      description: 'Please set the CLEARTAX_API_KEY in app settings to enable E-Way Bill generation.',
      variant: 'destructive',
    });
  }

  function handlePushToTally() {
    toast({
      title: 'Tally integration not configured yet',
      description: 'Please set the TALLY_API_URL and TALLY_API_KEY in app settings to enable Tally sync.',
      variant: 'destructive',
    });
  }

  return (
    <div className="space-y-4">
      {/* E-Invoice Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-semibold text-slate-900">E-Invoice (IRN)</span>
          {hasEInvoice && (
            <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Generated
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {hasEInvoice ? (
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500">IRN:</span> <span className="font-mono text-xs break-all">{invoice.irn}</span></div>
              <div><span className="text-slate-500">Acknowledgement No:</span> <span className="font-medium">{invoice.ack_number}</span></div>
              <div><span className="text-slate-500">Acknowledgement Date:</span> <span>{invoice.ack_date}</span></div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">E-Invoice not generated</p>
                <p className="text-xs text-amber-600 mt-0.5">Connect ClearTax API to auto-generate IRN. You can also enter manually below.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">IRN Number</Label>
              <Input className="h-9 text-sm mt-1 font-mono" value={irn} onChange={e => setIrn(e.target.value)}
                placeholder="Enter IRN manually or generate via ClearTax" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Acknowledgement Number</Label>
              <Input className="h-9 text-sm mt-1" value={ackNo} onChange={e => setAckNo(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" className="h-11 text-sm" onClick={handleGenerateEInvoice}>
            <FileText className="w-4 h-4 mr-2" /> Generate via ClearTax
          </Button>
        </div>
      </div>

      {/* E-Way Bill Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-900">E-Way Bill</span>
          {hasEwayBill && (
            <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Generated
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">E-Way Bill Number</Label>
            <Input className="h-9 text-sm mt-1" value={ewayBill} onChange={e => setEwayBill(e.target.value)}
              placeholder="Enter E-Way Bill number or generate via ClearTax" />
          </div>
          <Button variant="outline" className="h-11 text-sm" onClick={handleGenerateEwayBill}>
            <Truck className="w-4 h-4 mr-2" /> Generate E-Way Bill
          </Button>
        </div>
      </div>

      {/* Push to Tally */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-900">Push to Tally</span>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-3">Sync this invoice data to Tally accounting software.</p>
          <Button variant="outline" className="h-11 text-sm" onClick={handlePushToTally}>
            <Upload className="w-4 h-4 mr-2" /> Push to Tally
          </Button>
        </div>
      </div>
    </div>
  );
}