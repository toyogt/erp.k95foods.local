import { useState, useRef, useEffect } from 'react';
import { Search, Package, AlertTriangle, Zap, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import NumericInput from '@/components/ui/NumericInput';
import PickingPlanCard from '@/components/store/PickingPlanCard';
import { generatePickingPlan } from '@/components/store/SmartPickingEngine';

function SmartItemSelect({ items, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = items.find(i => i.item_code === value);
  const filtered = query.trim()
    ? items.filter(i =>
        i.item_name?.toLowerCase().includes(query.toLowerCase()) ||
        i.item_code?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.item_name} (${selected.item_code})` : 'Search item to issue...'}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input autoFocus className="flex-1 text-sm outline-none" placeholder="Search by item name or code..."
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No stored items found</p>
            ) : filtered.map(i => (
              <div key={i.item_code}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${i.item_code === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(i.item_code, i); setOpen(false); setQuery(''); }}>
                <p className="font-medium">{i.item_name}</p>
                <p className="text-xs text-slate-400">{i.item_code} · {i.total_stock?.toFixed(2)} {i.uom} in stock · {i.lots?.length || 0} lot(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export default function SmartIssueForm({ storedItems, allLots, allBalances, pickingStrategy, onIssue, saving }) {
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [pickingPlan, setPickingPlan] = useState(null);
  const [planResult, setPlanResult] = useState(null);

  const selectedItem = storedItems.find(i => i.item_code === selectedItemCode);

  function handleGeneratePlan() {
    if (!selectedItemCode || !requestedQty || parseFloat(requestedQty) <= 0) return;

    const result = generatePickingPlan(
      selectedItemCode,
      parseFloat(requestedQty),
      allLots,
      allBalances,
      pickingStrategy
    );

    setPickingPlan(result.plan);
    setPlanResult(result);
  }

  function handleConfirmIssue() {
    if (!pickingPlan || pickingPlan.length === 0) return;
    onIssue(pickingPlan, pickingStrategy);
    setSelectedItemCode('');
    setRequestedQty('');
    setPickingPlan(null);
    setPlanResult(null);
  }

  function handleReset() {
    setPickingPlan(null);
    setPlanResult(null);
  }

  const totalPicked = pickingPlan?.reduce((sum, p) => sum + p.pick_quantity, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Item + Quantity Selection */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-6">
          <Label className="text-xs font-medium text-slate-700">Select Item</Label>
          <SmartItemSelect items={storedItems} value={selectedItemCode}
            onChange={(code) => { setSelectedItemCode(code); setPickingPlan(null); setPlanResult(null); }} />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs font-medium text-slate-700">Required Quantity</Label>
          <NumericInput
            className="h-11 text-base mt-1"
            placeholder={selectedItem ? `Max: ${selectedItem.total_stock}` : '0'}
            value={requestedQty}
            onChange={e => { setRequestedQty(e.target.value); setPickingPlan(null); setPlanResult(null); }}
          />
        </div>
        <div className="md:col-span-1">
          <Label className="text-xs font-medium text-slate-700">Unit</Label>
          <div className="h-11 flex items-center px-3 mt-1 text-sm font-medium text-slate-700 bg-slate-100 rounded-md">
            {selectedItem?.uom || 'Nos'}
          </div>
        </div>
        <div className="md:col-span-2">
          <Button
            onClick={handleGeneratePlan}
            disabled={!selectedItemCode || !requestedQty || parseFloat(requestedQty) <= 0}
            className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Zap className="w-4 h-4" />
            Generate Plan
          </Button>
        </div>
      </div>

      {/* Picking Plan Result */}
      {pickingPlan && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Picking Plan — {pickingStrategy} Strategy
              </h3>
            </div>
            <button onClick={handleReset} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
              Reset
            </button>
          </div>

          {/* Summary */}
          <div className={`rounded-xl p-3 flex items-center justify-between ${
            planResult?.fulfilled ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div>
              <p className={`text-sm font-semibold ${planResult?.fulfilled ? 'text-green-700' : 'text-amber-700'}`}>
                {planResult?.fulfilled
                  ? `Full quantity available — ${totalPicked} ${selectedItem?.uom} from ${pickingPlan.length} pick(s)`
                  : `Partial availability — Only ${totalPicked} of ${requestedQty} ${selectedItem?.uom} available`
                }
              </p>
              {!planResult?.fulfilled && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Shortfall: {planResult?.remaining} {selectedItem?.uom}
                </p>
              )}
            </div>
            {!planResult?.fulfilled && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
          </div>

          {/* Individual Pick Cards */}
          <div className="space-y-2">
            {pickingPlan.map((p, idx) => (
              <PickingPlanCard key={`${p.lot_id}-${p.location_id}`} planItem={p} index={idx} />
            ))}
          </div>

          {/* Confirm Button */}
          {pickingPlan.length > 0 && (
            <Button
              onClick={handleConfirmIssue}
              disabled={saving}
              className="w-full h-11 text-base gap-2 bg-green-600 hover:bg-green-700"
            >
              <Package className="w-5 h-5" />
              {saving ? 'Processing...' : `Confirm Issue — ${totalPicked} ${selectedItem?.uom} from ${pickingPlan.length} pick(s)`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}