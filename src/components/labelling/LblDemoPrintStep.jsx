import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { sendRynanPrintCommand } from '@/lib/rynanPrinterService';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';

export default function LblDemoPrintStep({ job, user, onComplete }) {
  const [demoQty, setDemoQty] = useState('2');
  const [printerId, setPrinterId] = useState('');
  const [sending, setSending] = useState(false);

  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn: () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  const handleSendDemoPrint = async () => {
    if (!demoQty || Number(demoQty) <= 0) { toast({ title: 'Invalid Quantity', variant: 'destructive' }); return; }
    if (!printerId) { toast({ title: 'Select a printer', variant: 'destructive' }); return; }

    const printer = printers.find(p => p.printer_id === printerId);
    if (!printer) { toast({ title: 'Printer not found', variant: 'destructive' }); return; }

    setSending(true);

    const command = {
      type: 'demo',
      template: printer.demo_template || printer.default_template || '',
      quantity: Number(demoQty),
      job_id: job.job_id,
      batch_no: job.batch_no || '',
      product: job.product_name,
    };

    const result = await sendRynanPrintCommand(printer, command, {
      jobId: job.id,
      commandType: 'demo',
      quantity: Number(demoQty),
      user,
    });

    if (!result.success) {
      toast({ title: 'Demo Print Failed', description: result.errorMessage || 'Middleware returned an error', variant: 'destructive' });
      await logLabellingEvent({ action_type: 'printer_command_failed', job_id: job.id, plan_id: job.plan_id, description: `Demo print failed: ${result.errorMessage}`, user });
      setSending(false);
      return;
    }

    // Update job status with command tracking fields
    await base44.entities.LabellingJob.update(job.id, {
      status: 'demo_print_sent',
      demo_print_qty: Number(demoQty),
      demo_print_command_id: result.commandRecord?.command_id || null,
      demo_print_middleware_job_id: result.middlewareJobId || null,
    });

    await logLabellingEvent({
      action_type: 'demo_print_sent',
      job_id: job.id,
      plan_id: job.plan_id,
      description: `Demo print of ${demoQty} labels sent to printer ${printer.name}. Middleware job: ${result.middlewareJobId || 'N/A'}`,
      user,
    });

    toast({ title: 'Demo Print Sent', description: `${demoQty} demo labels sent. Proceed to verify physical output.` });
    onComplete?.();
    setSending(false);
  };

  const noPrinters = printers.length === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Printer className="w-5 h-5 text-purple-600" />
        <h2 className="text-base font-semibold text-slate-900">Send Demo Print</h2>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-slate-600"><span className="font-medium">Product:</span> {job.product_name}</p>
        <p className="text-slate-600"><span className="font-medium">Product Code:</span> {job.sku_code}</p>
        <p className="text-slate-600"><span className="font-medium">Planned:</span> {job.quantity_bottles_planned?.toLocaleString()} bottles</p>
        <p className="text-slate-600"><span className="font-medium">Stock Transferred:</span> {job.stock_transfer_qty?.toLocaleString()} bottles</p>
        {job.batch_no && <p className="text-slate-600"><span className="font-medium">Batch Number:</span> <span className="font-mono font-bold">{job.batch_no}</span></p>}
      </div>

      {noPrinters && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">No active printers configured. Please configure a printer in Lines &amp; Printers settings.</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Select Printer <span className="text-red-500">*</span></Label>
          <Select value={printerId} onValueChange={setPrinterId}>
            <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select printer" /></SelectTrigger>
            <SelectContent>
              {printers.map(p => (
                <SelectItem key={p.printer_id} value={p.printer_id}>{p.name} ({p.printer_id}) — {p.line_name || 'No line'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 max-w-xs">
          <Label className="text-xs font-medium text-slate-700">Demo Print Quantity (Labels)</Label>
          <Input type="number" value={demoQty} onChange={e => setDemoQty(e.target.value)} className="h-11 md:h-9" min="1" />
          <p className="text-xs text-slate-500">Number of sample labels to print for approval</p>
        </div>
      </div>

      <Button
        className="h-11 w-full md:w-auto gap-2 bg-purple-600 hover:bg-purple-700"
        onClick={handleSendDemoPrint}
        disabled={sending || noPrinters || !printerId}
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        Send Demo Print
      </Button>
    </div>
  );
}