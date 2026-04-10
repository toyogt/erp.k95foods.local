import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Printer } from 'lucide-react';

export default function LblDemoPrintStep({ job, user, onComplete }) {
  const [demoQty, setDemoQty] = useState('2');
  const [sending, setSending] = useState(false);

  const handleSendDemoPrint = async () => {
    if (!demoQty || Number(demoQty) <= 0) { toast({ title: 'Invalid Quantity', variant: 'destructive' }); return; }
    setSending(true);
    await base44.entities.LblPrintCommand.create({ command_id: `CMD-${Date.now()}`, job_id: job.id, command_type: 'demo', quantity: Number(demoQty), status: 'sent', sent_at: new Date().toISOString(), sent_by: user?.email });
    await base44.entities.LabellingJob.update(job.id, { status: 'demo_print_sent', demo_print_qty: Number(demoQty) });
    await logLabellingEvent({ action_type: 'demo_print_sent', job_id: job.id, plan_id: job.plan_id, description: `Demo print of ${demoQty} labels sent`, user });
    toast({ title: 'Demo Print Sent', description: `${demoQty} demo labels sent to printer` });
    onComplete?.();
    setSending(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2"><Printer className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold text-slate-900">Send Demo Print</h2></div>
      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-slate-600"><span className="font-medium">Product:</span> {job.product_name}</p>
        <p className="text-slate-600"><span className="font-medium">Product Code:</span> {job.sku_code}</p>
        <p className="text-slate-600"><span className="font-medium">Planned:</span> {job.quantity_bottles_planned?.toLocaleString()} bottles</p>
        <p className="text-slate-600"><span className="font-medium">Stock Transferred:</span> {job.stock_transfer_qty?.toLocaleString()} bottles</p>
      </div>
      <div className="space-y-1 max-w-xs">
        <Label className="text-xs font-medium text-slate-700">Demo Print Quantity (Labels)</Label>
        <Input type="number" value={demoQty} onChange={e => setDemoQty(e.target.value)} className="h-11 md:h-9" />
        <p className="text-xs text-slate-500">Number of sample labels to print for approval</p>
      </div>
      <Button className="h-11 w-full md:w-auto gap-2 bg-purple-600 hover:bg-purple-700" onClick={handleSendDemoPrint} disabled={sending}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}Send Demo Print</Button>
    </div>
  );
}