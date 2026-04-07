import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Search, Plus, AlertTriangle, Camera, Loader2, ImageIcon, ChevronDown } from 'lucide-react';
import { ValidationAlert } from '@/components/store/SweetAlert';

function ItemSearchSelect({ value, storeItems, onChangeName, onSelectItem }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? storeItems.filter(s => s.item_name?.toLowerCase().includes(query.toLowerCase()))
    : storeItems;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 pl-8 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Search from Store Item Master..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              {query.trim()
                ? <span className="text-amber-600">Item not found in Store Item Master. Please add it via Item Master first.</span>
                : 'Start typing to search items...'
              }
            </div>
          ) : filtered.map((s, i) => (
            <div key={i} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 flex items-center gap-2"
              onClick={() => { setQuery(s.item_name); setOpen(false); onSelectItem(s); }}>
              {s.material_photo ? (
                <img src={s.material_photo} alt="" className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-slate-800">{s.item_name}</p>
                <p className="text-xs text-slate-400">
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

function ItemPhotoUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  }

  if (value) {
    return (
      <div className="relative group w-16 h-16">
        <img src={value} alt="Material" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
        <button onClick={() => onChange('')}
          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
      {uploading ? (
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
      ) : (
        <Camera className="w-4 h-4 text-slate-400" />
      )}
      <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
    </label>
  );
}

function PerItemSupplierSelect({ value, onChange, suppliers }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? suppliers.filter(s => s.supplier_name?.toLowerCase().includes(query.toLowerCase()))
    : suppliers;

  const selectedSupplier = suppliers.find(s => s.supplier_name === value);

  return (
    <div className="relative" ref={ref}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm text-left flex items-center justify-between bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
        >
          <span className={value ? 'text-slate-900 font-medium' : 'text-slate-400'}>
            {value || 'Select supplier...'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            autoFocus
            className="w-full h-11 pl-8 pr-8 border border-teal-400 rounded-xl text-sm focus:outline-none ring-1 ring-teal-400"
            placeholder="Search supplier..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); setOpen(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
              title="Clear"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              {query.trim()
                ? <span className="text-amber-600">No supplier found. Add suppliers in Supplier Manager first.</span>
                : 'No approved suppliers available.'
              }
            </div>
          ) : filtered.map(s => (
            <div
              key={s.id}
              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${
                s.supplier_name === value ? 'bg-teal-50 font-semibold text-teal-800' : 'text-slate-800'
              }`}
              onClick={() => { onChange(s.supplier_name); setQuery(''); setOpen(false); }}
            >
              <p className="font-medium">{s.supplier_name}</p>
              {s.supplier_id && <p className="text-xs text-slate-400">{s.supplier_id}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GRNItemCard({ index, item, storeItems, suppliers, canRemove, onUpdate, onSelectMasterItem, onRemove }) {
  const rules = item._rules;
  const hasItem = !!item.item_name?.trim();

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Item Header — shows after selection */}
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

      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Top row: Item search + remove (if no rules header) */}
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

        {/* Row 1: Item Name, Original Quantity, Unit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
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
            <Label className="text-xs font-medium text-slate-700">Original Quantity <span className="text-red-500">*</span></Label>
            <Input type="number" className="h-11 text-sm mt-1" value={item.original_quantity || ''}
              onChange={e => {
                onUpdate('original_quantity', e.target.value);
                if (!item.qty_mismatch || item.qty_mismatch === 'no') {
                  onUpdate('quantity', e.target.value);
                }
              }} placeholder="As per invoice" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Unit</Label>
            <select className="w-full h-11 border border-slate-200 rounded-xl px-2 text-sm mt-1"
              value={item.uom} onChange={e => onUpdate('uom', e.target.value)}>
              <option value="Nos">Numbers</option>
              <option value="Kg">Kilograms</option>
              <option value="Ltr">Litres</option>
              <option value="ML">Millilitres</option>
              <option value="Pcs">Pieces</option>
              <option value="Box">Boxes</option>
            </select>
          </div>
        </div>

        {/* Row 1b: Quantity Mismatch */}
        {item.original_quantity && parseFloat(item.original_quantity) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div>
              <Label className="text-xs font-medium text-slate-700">Quantity Mismatch?</Label>
              <select className="w-full h-11 border border-slate-200 rounded-xl px-2 text-sm mt-1"
                value={item.qty_mismatch || 'no'} onChange={e => {
                  onUpdate('qty_mismatch', e.target.value);
                  if (e.target.value === 'no') {
                    onUpdate('quantity', item.original_quantity);
                    onUpdate('mismatch_type', 'none');
                    onUpdate('mismatch_reason', '');
                  } else {
                    onUpdate('quantity', '');
                  }
                }}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {item.qty_mismatch === 'yes' && (
              <>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Mismatch Type <span className="text-red-500">*</span></Label>
                  <select className="w-full h-11 border border-slate-200 rounded-xl px-2 text-sm mt-1"
                    value={item.mismatch_type || ''} onChange={e => onUpdate('mismatch_type', e.target.value)}>
                    <option value="">Select type</option>
                    <option value="damaged">Damaged</option>
                    <option value="decreased">Decreased (Short received)</option>
                    <option value="increased">Increased (Excess received)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Actual Received Quantity <span className="text-red-500">*</span></Label>
                  <Input type="number" className="h-11 text-sm mt-1" value={item.quantity}
                    onChange={e => onUpdate('quantity', e.target.value)} placeholder="Actual count" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Reason <span className="text-red-500">*</span></Label>
                  <Input className="h-11 text-sm mt-1" value={item.mismatch_reason || ''}
                    onChange={e => onUpdate('mismatch_reason', e.target.value)} placeholder="Reason for mismatch" />
                </div>
              </>
            )}

            {(!item.qty_mismatch || item.qty_mismatch === 'no') && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Received Quantity</Label>
                <div className="h-11 flex items-center text-sm font-bold text-green-700 mt-1">
                  {item.original_quantity} {item.uom}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 2: Batch/Lot, Supplier, Photo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Batch / Lot {rules?.batch_required && <span className="text-red-500">*</span>}
            </Label>
            <Input className="h-11 text-sm mt-1" value={item.batch_lot}
              onChange={e => onUpdate('batch_lot', e.target.value)}
              placeholder={rules?.batch_required ? 'Enter batch number' : 'Optional'} />
            {rules?.batch_required && !item.batch_lot?.trim() && (
              <p className="text-xs text-red-500 mt-0.5">Batch number is mandatory for this item</p>
            )}
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Supplier Name <span className="text-red-500">*</span></Label>
            <div className="mt-1">
              <PerItemSupplierSelect
                value={item.supplier_name}
                onChange={v => onUpdate('supplier_name', v)}
                suppliers={suppliers || []}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Material Photo</Label>
            <div className="mt-1">
              <ItemPhotoUpload value={item.material_photo} onChange={v => onUpdate('material_photo', v)} />
            </div>
          </div>
        </div>

        {/* Row 3: Expiry + Mfg date (conditional) */}
        {(rules?.expiry_required || rules?.mfg_date_required) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules?.expiry_required && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Expiry Date <span className="text-red-500">*</span></Label>
                <Input type="date" className="h-11 text-sm mt-1" value={item.expiry_date}
                  onChange={e => onUpdate('expiry_date', e.target.value)} />
                {!item.expiry_date && <p className="text-xs text-red-500 mt-0.5">Expiry date is mandatory</p>}
              </div>
            )}
            {rules?.mfg_date_required && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Manufacture Date <span className="text-red-500">*</span></Label>
                <Input type="date" className="h-11 text-sm mt-1" value={item.mfg_date}
                  onChange={e => onUpdate('mfg_date', e.target.value)} />
                {!item.mfg_date && <p className="text-xs text-red-500 mt-0.5">Manufacture date is mandatory</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}