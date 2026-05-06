import { useState, useRef, useEffect } from 'react';
import { Trash2, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import NumericInput from '@/components/ui/NumericInput';

export default function PRItemRowEnhanced({ item, index, ingredients, uoms, onUpdate, onRemove, canRemove }) {
  const [query, setQuery] = useState(item.item_name || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(item.item_name || ''); }, [item.item_name]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? ingredients.filter(i => i.item_name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q)).slice(0, 15)
    : ingredients.slice(0, 15);

  function selectItem(ing) {
    onUpdate({ item_code: ing.item_code || ing.item_name, item_name: ing.item_name, unit: ing.base_uom || ing.uom || '' });
    setQuery(ing.item_name);
    setOpen(false);
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Item {index + 1}</span>
        {canRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>}
      </div>

      <div className="relative" ref={ref}>
        <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="w-full h-11 md:h-9 pl-8 pr-3 border border-slate-200 rounded-xl text-sm"
            placeholder="Search items..." value={query}
            onChange={e => { setQuery(e.target.value); onUpdate({ item_name: e.target.value }); setOpen(true); }}
            onFocus={() => setOpen(true)} />
        </div>
        {open && filtered.length > 0 && (
          <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(ing => (
              <div key={ing.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50" onClick={() => selectItem(ing)}>
                <p className="font-medium text-slate-800">{ing.item_name}</p>
                <p className="text-xs text-slate-400">{ing.item_code || ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
          <NumericInput className="h-11 md:h-9 text-sm mt-1" value={item.quantity || ''} onChange={e => onUpdate({ quantity: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Unit *</Label>
          <select className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-2 text-sm mt-1 bg-white"
            value={item.unit || ''} onChange={e => onUpdate({ unit: e.target.value })}>
            <option value="">Select</option>
            {uoms.map(u => <option key={u.id} value={u.uom_code || u.uom_name}>{u.uom_name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Est. Rate</Label>
          <NumericInput className="h-11 md:h-9 text-sm mt-1" value={item.estimated_rate || ''} onChange={e => onUpdate({ estimated_rate: e.target.value })} placeholder="₹" />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-slate-700">Remarks</Label>
        <input className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={item.remarks || ''} onChange={e => onUpdate({ remarks: e.target.value })} placeholder="Optional" />
      </div>
    </div>
  );
}