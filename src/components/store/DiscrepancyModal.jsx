import { useState } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function DiscrepancyModal({ entry, physicalQty, onProceed, onAdjust, onCancel }) {
  const { toast } = useToast();
  const [adjusting, setAdjusting] = useState(false);
  const [adjustedQty, setAdjustedQty] = useState(physicalQty);
  const variance = physicalQty - entry.system_quantity;
  const isDamaged = variance < 0;

  async function handleAdjustPutaway() {
    if (adjustedQty === '' || parseFloat(adjustedQty) < 0) {
      toast({ title: 'Invalid quantity', variant: 'destructive' });
      return;
    }
    setAdjusting(true);
    await onAdjust({
      adjustedQty: parseFloat(adjustedQty),
      reason: isDamaged ? 'damaged' : 'fewer_units_found',
    });
    setAdjusting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={`w-6 h-6 shrink-0 ${isDamaged ? 'text-red-500' : 'text-orange-500'}`} />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isDamaged ? 'Damaged Units Found' : 'Fewer Units Than Expected'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {entry.item_name} · {entry.lot_id}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-5 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">System Quantity:</span>
            <span className="font-medium text-slate-900">
              {entry.system_quantity} {entry.uom}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Physical Count:</span>
            <span className="font-medium text-slate-900">
              {physicalQty} {entry.uom}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
            <span className={`font-bold ${isDamaged ? 'text-red-600' : 'text-orange-600'}`}>
              Variance:
            </span>
            <span className={`font-bold ${isDamaged ? 'text-red-600' : 'text-orange-600'}`}>
              {variance > 0 ? '+' : ''}{variance} {entry.uom}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          How would you like to resolve this discrepancy?
        </p>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-11 text-base justify-start gap-3"
            onClick={onProceed}
          >
            <span>✓ Accept Count</span>
            <span className="text-xs text-slate-500 ml-auto">Record as-is</span>
          </Button>

          <div className="border-t border-slate-200 pt-3">
            <Label className="text-xs font-medium text-slate-700 mb-2 block">
              <Zap className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
              Adjust Putaway Quantity
            </Label>
            <Input
              type="number"
              className="h-11 text-base mb-2"
              placeholder="Enter corrected quantity"
              value={adjustedQty}
              onChange={e => setAdjustedQty(e.target.value)}
              min="0"
            />
            <p className="text-xs text-slate-400 mb-3">
              Updates the source putaway lot to match physical count
            </p>
            <Button
              className="w-full h-11 text-base gap-2 bg-blue-600 hover:bg-blue-700"
              disabled={adjustedQty === '' || adjusting}
              onClick={handleAdjustPutaway}
            >
              {adjusting ? 'Adjusting...' : 'Update Putaway & Record'}
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full h-9 text-sm mt-3 text-slate-600"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}