import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';
import OpeningStockLotForm from './OpeningStockLotForm';
import OpeningStockLotList from './OpeningStockLotList';

export default function OpeningStockItemPanel({ item, initialLots = [], onLotAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const totalQty = initialLots.reduce((s, l) => s + (l.quantity || 0), 0);

  function handleSaved(entry) {
    setShowForm(false);
    if (onLotAdded) onLotAdded(entry);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Item header row */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{item.item_name}</p>
            <p className="text-xs text-slate-400 font-mono">{item.item_code} · {item.uom || 'Nos'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-teal-700">{totalQty} {item.uom || 'Nos'}</p>
            <p className="text-xs text-slate-400">{initialLots.length} lot{initialLots.length !== 1 ? 's' : ''}</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-4">
          {!showForm && (
            <div className="flex justify-end">
              <Button size="sm" className="h-9 gap-1.5 bg-teal-700 hover:bg-teal-800 text-sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Add Lot
              </Button>
            </div>
          )}

          {showForm && (
            <div className="border border-teal-200 bg-teal-50/30 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-3">New Opening Stock Lot</p>
              <OpeningStockLotForm item={item} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
            </div>
          )}

          <OpeningStockLotList lots={initialLots} />
        </div>
      )}
    </div>
  );
}