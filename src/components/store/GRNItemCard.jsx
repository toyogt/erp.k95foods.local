import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Trash2, Search, Plus, AlertTriangle, ImageIcon, ChevronDown } from 'lucide-react';
import NumericInput from '@/components/ui/NumericInput';

function ItemSearchSelect({ value, storeItems, onChangeName, onSelectItem }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isUserTyping) setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setIsUserTyping(false); } }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Only filter when user is actively typing a search query
  const q = isUserTyping ? query.trim().toLowerCase() : '';
  const filtered = q
    ? storeItems.filter(s =>
        (s.item_name || '').toLowerCase().includes(q) ||
        (s.item_code || '').toLowerCase().includes(q)
      )
    : storeItems;

  function handleFocus() {
    setOpen(true);
    // Clear query to show all items, but only visually
    if (value && !isUserTyping) {
      setQuery('');
      setIsUserTyping(true);
    }
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setIsUserTyping(true);
    setOpen(true);
  }

  function handleSelect(s) {
    setQuery(s.item_name);
    setOpen(false);
    setIsUserTyping(false);
    onSelectItem(s);
  }

  // Sync query when value changes externally (e.g. when item is changed)
  useEffect(() => {
    if (!isUserTyping && value) setQuery(value);
  }, [value, isUserTyping]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          ref={inputRef}
          className="w-full h-11 pl-8 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Search items by name or code..."
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto" style={{ zIndex: 9999 }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-amber-600">
              No items found. Please add items via Item Master first.
            </div>
          ) : filtered.map((s, i) => (
            <div key={s.id || i} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 flex items-start gap-2 border-b border-slate-50 last:border-0"
              onClick={() => handleSelect(s)}>
              {s.material_photo ? (
                <img src={s.material_photo} alt="" className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 mt-0.5" />
              ) : (
                <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <ImageIcon className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 break-words leading-snug">{s.item_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.item_code && `${s.item_code} · `}
                  {s.item_category?.replace('_', ' ')} · {s.uom || 'Nos'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GRNItemCard({ index, item, storeItems, canRemove, onUpdate, onSelectMasterItem, onRemove }) {
  const rules = item._rules;
  const hasItem = !!item.item_name?.trim();

  return (
    <div className="border border-slate-200 rounded-xl" style={{ overflow: 'visible' }}>
      {hasItem && rules && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          {rules.material_photo ? (
            <img src={rules.material_photo} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 text-teal-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm truncate">{item.item_name}</span>
              {rules.batch_required && <span className="px-2 py-0.5 border border-blue-300 text-blue-700 rounded-full text-xs font-medium">Batch required</span>}
              {rules.expiry_required && <span className="px-2 py-0.5 border border-orange-300 text-orange-700 rounded-full text-xs font-medium">Expiry required</span>}
              {rules.qc_required && <span className="px-2 py-0.5 border border-red-300 text-red-700 rounded-full text-xs font-medium">Quality Control</span>}
            </div>
            <p className="text-xs text-slate-400">From Store Item Master</p>
          </div>
          {canRemove && (
            <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1.5 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        {!hasItem && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Item {index + 1}</span>
            {canRemove && (
              <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs font-medium text-slate-700">Item Name <span className="text-red-500">*</span></Label>
            <div className="mt-1">
              <ItemSearchSelect
                value={item.item_name}
                storeItems={storeItems}
                onChangeName={v => onUpdate('item_name', v)}
                onSelectItem={onSelectMasterItem}
              />
            </div>
          </div>
           <div>
             <Label className="text-xs font-medium text-slate-700">Unit</Label>
             <div className="w-full h-11 flex items-center px-3 mt-1 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-xl">
                {item.uom || 'Nos'}
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Original Quantity <span className="text-red-500">*</span></Label>
              <NumericInput className="h-11 text-sm mt-1" value={item.original_quantity || ''}
                onChange={e => {
                  onUpdate('original_quantity', e.target.value);
                  if (!item.qty_mismatch || item.qty_mismatch === 'no') {
                    onUpdate('quantity', e.target.value);
                  }
                }} placeholder="As per invoice" />
            </div>
        </div>
        
        {item.original_quantity && parseFloat(item.original_quantity) > 0 && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Quantity Mismatch?</Label>
                <select className="w-full h-11 border border-slate-200 rounded-xl px-2 text-sm mt-1"
                  value={item.qty_mismatch || 'no'} onChange={e => {
                    onUpdate('qty_mismatch', e.target.value);
                    if (e.target.value === 'no') {
                      onUpdate('quantity', item.original_quantity);
                      onUpdate('mismatch_type', 'none');
                      onUpdate('mismatch_reason', '');
                      onUpdate('short_qty', '');
                      onUpdate('damaged_qty', '');
                      onUpdate('damage_reason', '');
                    } else {
                      onUpdate('quantity', '');
                    }
                  }}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {(!item.qty_mismatch || item.qty_mismatch === 'no') && (
                <div>
                  <Label className="text-xs font-medium text-slate-700">Received Quantity</Label>
                  <div className="h-11 flex items-center text-sm font-bold text-green-700 mt-1">
                    {item.original_quantity} {item.uom}
                  </div>
                </div>
              )}
            </div>

            {item.qty_mismatch === 'yes' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Mismatch Type <span className="text-red-500">*</span></Label>
                    <select className="w-full h-11 border border-slate-200 rounded-xl px-2 text-sm mt-1"
                      value={item.mismatch_type || ''} onChange={e => {
                        onUpdate('mismatch_type', e.target.value);
                        onUpdate('short_qty', '');
                        onUpdate('damaged_qty', '');
                        onUpdate('damage_reason', '');
                        onUpdate('mismatch_reason', '');
                        onUpdate('quantity', '');
                      }}>
                      <option value="">Select type</option>
                      <option value="damaged">Damaged Only</option>
                      <option value="decreased">Short Received Only</option>
                      <option value="increased">Excess Received</option>
                      <option value="short_and_damaged">Short + Damaged</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Reason <span className="text-red-500">*</span></Label>
                    <input className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={item.mismatch_reason || ''}
                      onChange={e => onUpdate('mismatch_reason', e.target.value)} placeholder="Reason for mismatch" />
                  </div>
                </div>

                {/* Short + Damaged: two separate inputs */}
                {item.mismatch_type === 'short_and_damaged' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-red-600">Short Quantity <span className="text-red-500">*</span></Label>
                      <NumericInput className="h-11 text-sm mt-1" value={item.short_qty || ''}
                        onChange={e => {
                          const short = parseFloat(e.target.value) || 0;
                          const damaged = parseFloat(item.damaged_qty) || 0;
                          const orig = parseFloat(item.original_quantity) || 0;
                          const actual = Math.max(0, orig - short - damaged);
                          onUpdate('short_qty', e.target.value);
                          onUpdate('quantity', String(actual));
                        }} placeholder="Units short" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-orange-600">Damaged Quantity <span className="text-red-500">*</span></Label>
                      <NumericInput className="h-11 text-sm mt-1" value={item.damaged_qty || ''}
                        onChange={e => {
                          const damaged = parseFloat(e.target.value) || 0;
                          const short = parseFloat(item.short_qty) || 0;
                          const orig = parseFloat(item.original_quantity) || 0;
                          const actual = Math.max(0, orig - short - damaged);
                          onUpdate('damaged_qty', e.target.value);
                          onUpdate('quantity', String(actual));
                        }} placeholder="Units damaged" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Usable Received</Label>
                      <div className="h-11 flex items-center text-sm font-bold text-slate-900 mt-1 px-3 border border-slate-200 rounded-xl bg-white">
                        {item.quantity || '—'} {item.uom}
                      </div>
                    </div>
                  </div>
                )}

                {/* Single type: Damaged only */}
                {item.mismatch_type === 'damaged' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-orange-600">Damaged Quantity <span className="text-red-500">*</span></Label>
                      <NumericInput className="h-11 text-sm mt-1" value={item.damaged_qty || ''}
                        onChange={e => {
                          const diff = parseFloat(e.target.value) || 0;
                          const orig = parseFloat(item.original_quantity) || 0;
                          onUpdate('damaged_qty', e.target.value);
                          onUpdate('quantity', String(Math.max(0, orig - diff)));
                        }} placeholder="Number of damaged units" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Actual Received Quantity</Label>
                      <div className="h-11 flex items-center text-sm font-bold text-slate-900 mt-1 px-3 border border-slate-200 rounded-xl bg-white">
                        {item.quantity || '—'} {item.uom}
                      </div>
                    </div>
                  </div>
                )}

                {/* Single type: Short received */}
                {item.mismatch_type === 'decreased' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-red-600">Short By <span className="text-red-500">*</span></Label>
                      <NumericInput className="h-11 text-sm mt-1" value={item.short_qty || ''}
                        onChange={e => {
                          const diff = parseFloat(e.target.value) || 0;
                          const orig = parseFloat(item.original_quantity) || 0;
                          onUpdate('short_qty', e.target.value);
                          onUpdate('quantity', String(Math.max(0, orig - diff)));
                        }} placeholder="Short quantity" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Actual Received Quantity</Label>
                      <div className="h-11 flex items-center text-sm font-bold text-slate-900 mt-1 px-3 border border-slate-200 rounded-xl bg-white">
                        {item.quantity || '—'} {item.uom}
                      </div>
                    </div>
                  </div>
                )}

                {/* Single type: Excess */}
                {item.mismatch_type === 'increased' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-blue-600">Excess By <span className="text-red-500">*</span></Label>
                      <NumericInput className="h-11 text-sm mt-1" value={item.mismatch_qty || ''}
                        onChange={e => {
                          const diff = parseFloat(e.target.value) || 0;
                          const orig = parseFloat(item.original_quantity) || 0;
                          onUpdate('mismatch_qty', e.target.value);
                          onUpdate('quantity', String(orig + diff));
                        }} placeholder="Excess quantity" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Actual Received Quantity</Label>
                      <div className="h-11 flex items-center text-sm font-bold text-slate-900 mt-1 px-3 border border-slate-200 rounded-xl bg-white">
                        {item.quantity || '—'} {item.uom}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {rules?.batch_required && <div>
          <Label className="text-xs font-medium text-slate-700">
            Manufacturer Batch / Lot Number <span className="text-red-500">*</span>
          </Label>
          <input className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={item.batch_lot}
            onChange={e => onUpdate('batch_lot', e.target.value)}
            placeholder={'Enter batch number'} />
          {!item.batch_lot?.trim() && (
            <p className="text-xs text-red-500 mt-0.5">Batch number is mandatory for this item</p>
          )}
        </div>}

        {/* Supplier Lot Number — always visible when batch is captured */}
        {hasItem && (
          <div>
            <Label className="text-xs font-medium text-slate-700">Supplier Lot / Reference Number</Label>
            <input className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={item.supplier_lot || ''}
              onChange={e => onUpdate('supplier_lot', e.target.value)}
              placeholder="Supplier's own batch/lot reference (optional)" />
          </div>
        )}

        {/* Always show Manufacture and Expiry date fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Manufacture Date {rules?.mfg_date_required && <span className="text-red-500">*</span>}
            </Label>
            <input type="date" className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={item.mfg_date || ''}
              onChange={e => onUpdate('mfg_date', e.target.value)} />
            {rules?.mfg_date_required && !item.mfg_date && <p className="text-xs text-red-500 mt-0.5">Manufacture date is mandatory</p>}
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Expiry Date {rules?.expiry_required && <span className="text-red-500">*</span>}
            </Label>
            <input type="date" className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={item.expiry_date || ''}
              onChange={e => onUpdate('expiry_date', e.target.value)} />
            {rules?.expiry_required && !item.expiry_date && <p className="text-xs text-red-500 mt-0.5">Expiry date is mandatory</p>}
          </div>
        </div>

      </div>
    </div>
  );
}