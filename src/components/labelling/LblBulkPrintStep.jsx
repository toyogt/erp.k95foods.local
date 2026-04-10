import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';

export default function LblBulkPrintStep({ job, user, onComplete, mode }) {
  const [printedQty, setPrintedQty] = useState(job.current_printed_qty || 0);
  const [acting, setActing] = useState(false);
  const remaining = (job.quantity_bottles_planned || 0) - printedQty;
  const progress = job.quantity_bottles_planned ? Math.min(100, (printedQty / job.quantity_bottles_planned) * 100) : 0;

  const handleAction = async (actionType, nextStatus) => {
    setActing(true);
    await base44.entities.LabellingJob.update(job.id, { status: nextStatus, current_printed_qty: printedQty });
    await base44.entities.LblPrintCommand.create({ command_id: `CMD-${Date.now()}`, job_id: job.id, command_type: actionType === 'bulk_print_started' ? 'bulk_start' : actionType === 'bulk_print_stopped' ? 'bulk_stop' : 'bulk_resume', quantity: job.quantity_bottles_planned, status: 'sent', sent_at: new Date().toISOString(), sent_by: user?.email });
    await logLabellingEvent({ action_type: actionType, job_id: job.id, plan_id: job.plan_id, description: `Bulk print ${actionType.replace('bulk_print_', '')} for job ${job.job_id}`, user });
    toast({ title: actionType === 'bulk_print_started' ? 'Bulk Printing Started' : actionType === 'bulk_print_stopped' ? 'Printing Paused' : 'Printing Resumed' });
    onComplete?.();
    setActing(false);
  };

  const handleUpdateQty = async () => {
    await base44.entities.LabellingJob.update(job.id, { current_printed_qty: printedQty });
    toast({ title: 'Printed Quantity Updated' });
    onComplete?.();
  };

  if (mode === 'start') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Ready for Bulk Printing</h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">Demo print approved! You can now start bulk label printing.</div>
        <div className="bg-slate-50 rounded-lg p-3 text-sm"><p><span className="font-medium">Target:</span> {job.quantity_bottles_planned?.toLocaleString()} bottles</p><p><span className="font-medium">Product:</span> {job.product_name}</p></div>
        <Button className="h-11 w-full md:w-auto gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleAction('bulk_print_started', 'bulk_printing')} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Start Bulk Print</Button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Bulk Print Control</h2>
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span className="text-slate-600">Progress</span><span className="font-medium text-slate-900">{progress.toFixed(1)}%</span></div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${job.status === 'paused' ? 'bg-orange-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} /></div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-500">Target</p><p className="text-lg font-bold text-slate-900">{job.quantity_bottles_planned?.toLocaleString()}</p></div>
          <div className="bg-indigo-50 rounded-lg p-2"><p className="text-xs text-indigo-500">Printed</p><p className="text-lg font-bold text-indigo-700">{printedQty.toLocaleString()}</p></div>
          <div className="bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-500">Remaining</p><p className="text-lg font-bold text-slate-900">{Math.max(0, remaining).toLocaleString()}</p></div>
        </div>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1"><Label className="text-xs font-medium text-slate-700">Current Printed Count</Label><Input type="number" value={printedQty} onChange={e => setPrintedQty(Number(e.target.value))} className="h-11 md:h-9" /></div>
        <Button variant="outline" className="h-11 md:h-9" onClick={handleUpdateQty}>Update</Button>
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        {job.status === 'bulk_printing' && <Button variant="outline" className="h-11 flex-1 gap-2 border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => handleAction('bulk_print_stopped', 'paused')} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}Stop Printing</Button>}
        {job.status === 'paused' && <Button className="h-11 flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleAction('bulk_print_resumed', 'bulk_printing')} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}Resume Printing</Button>}
      </div>
    </div>
  );
}