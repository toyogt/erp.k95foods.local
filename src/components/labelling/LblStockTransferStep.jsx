import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Package } from 'lucide-react';

export default function LblStockTransferStep({ job, user, onComplete }) {
  const [qty, setQty] = useState('');
  const [batch, setBatch] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!qty || Number(qty) <= 0) {
      toast({ title: 'Invalid Quantity', description: 'Enter a valid transfer quantity', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await base44.entities.LabellingJob.update(job.id, { status: 'stock_transferred', stock_transfer_qty: Number(qty), stock_transfer_batch: batch, stock_transfer_remarks: remarks });
    await logLabellingEvent({ action_type: 'stock_transferred', job_id: job.id, plan_id: job.plan_id, description: `Transferred ${qty} bottles for job ${job.job_id}`, details_json: { qty: Number(qty), batch, remarks }, user });
    toast({ title: 'Stock Transfer Recorded' });
    onComplete?.();
    setSaving(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2"><Package className="w-5 h-5 text-cyan-600" /><h2 className="text-base font-semibold text-slate-900">Record Stock Transfer</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Transfer Quantity (Bottles)</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Enter quantity" className="h-11 md:h-9" /></div>
        <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Batch / Lot (Optional)</Label><Input value={batch} onChange={e => setBatch(e.target.value)} placeholder="Batch or lot number" className="h-11 md:h-9" /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Remarks (Optional)</Label><Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any notes..." className="min-h-[60px]" /></div>
      <Button className="h-11 w-full md:w-auto gap-2" onClick={handleSubmit} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Submit Stock Transfer</Button>
    </div>
  );
}