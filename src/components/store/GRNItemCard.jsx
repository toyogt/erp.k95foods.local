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
          placeholder="Type to search or add new..."
          value={query}
          onChange={e => { setQuery(e.target.value); onChangeName(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            query.trim()
              ? <div className="px-4 py-2.5 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 flex items-center gap-2" onClick={() => { setOpen(false); onChangeName(query); }}>
                  <Plus className="w-3.5 h-3.5" /> Add "{query}" as new item
                </div>
              : <div className="px-4 py-3 text-sm text-slate-400">No items found. Start typing...</div>
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
    ? suppliers.filter(s => s.supplier_name?.toLowerCase().includes(query.toLowerCase()))
    : suppliers;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 pl-8 pr-8 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Search supplier..."
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <div key={s.id} className="px-4 py-2 text-sm cursor-pointer hover:bg-slate-50"
              onClick={() => { setQuery(s.supplier_name); setOpen(false); onChange(s.supplier_name); }}>
              <p className="font-medium text-slate-800">{s.supplier_name}</p>
              <p className="text-xs text-slate-400">{s.supplier_id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GRNItemCard({ index, item, storeItems, suppliers, canRemove, onUpdate, onSelectMasterItem, onRemove }) {
  const rules = item._rules;

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Item {index + 1}</span>
        {canRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Item Name */}
        <div>
          <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
          <div className="mt-1">
            <ItemSearchSelect
              value={item.item_name}
              storeItems={storeItems}
              onChangeName={v => onUpdate('item_name', v)}
              onSelectItem={onSelectMasterItem}
            />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Type to search from Store Item Master or add new</p>
        </div>

        {/* Master photo reference */}
        {rules?.material_photo && (
          <div className="flex items-center gap-2 bg-teal-50 rounded-lg p-2">
            <img src={rules.material_photo} alt="" className="w-10 h-10 rounded object-cover border border-teal-200" />
            <span className="text-xs text-teal-700">Reference photo from Item Master</span>
          </div>
        )}

        {/* Validation rules badges */}
        {rules && (
          <div className="flex flex-wrap gap-1">
            {rules.batch_required && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Batch Required</span>}
            {rules.expiry_required && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Expiry Required</span>}
            {rules.mfg_date_required && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Manufacture Date Required</span>}
            {rules.qc_required && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Quality Control Required</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {/* Quantity */}
          <div>
            <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
            <Input type="number" className="h-11 text-sm mt-1" value={item.quantity}
              onChange={e => onUpdate('quantity', e.target.value)} placeholder="0" />
          </div>

          {/* Unit */}
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

          {/* Batch / Lot */}
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Batch / Lot {rules?.batch_required && <span className="text-red-500">*</span>}
            </Label>
            <Input className="h-11 text-sm mt-1" value={item.batch_lot}
              onChange={e => onUpdate('batch_lot', e.target.value)}
              placeholder={rules?.batch_required ? 'Required' : 'Optional'} />
            {rules?.batch_required && !item.batch_lot?.trim() && (
              <p className="text-xs text-red-500 mt-0.5">Batch number is mandatory for this item</p>
            )}
          </div>

          {/* Expiry Date */}
          {rules?.expiry_required && (
            <div>
              <Label className="text-xs font-medium text-slate-700">
                Expiry Date <span className="text-red-500">*</span>
              </Label>
              <Input type="date" className="h-11 text-sm mt-1" value={item.expiry_date}
                onChange={e => onUpdate('expiry_date', e.target.value)} />
              {!item.expiry_date && (
                <p className="text-xs text-red-500 mt-0.5">Expiry date is mandatory</p>
              )}
            </div>
          )}

          {/* Manufacturing Date */}
          {rules?.mfg_date_required && (
            <div>
              <Label className="text-xs font-medium text-slate-700">
                Manufacture Date <span className="text-red-500">*</span>
              </Label>
              <Input type="date" className="h-11 text-sm mt-1" value={item.mfg_date}
                onChange={e => onUpdate('mfg_date', e.target.value)} />
              {!item.mfg_date && (
                <p className="text-xs text-red-500 mt-0.5">Manufacture date is mandatory</p>
              )}
            </div>
          )}
        </div>

        {/* Per-item supplier */}
        <div>
          <Label className="text-xs font-medium text-slate-700">Supplier Name</Label>
          <div className="mt-1">
            <PerItemSupplierSelect
              value={item.supplier_name}
              onChange={v => onUpdate('supplier_name', v)}
              suppliers={suppliers || []}
            />
          </div>
        </div>

        {/* Material photo upload for this GRN line */}
        <div>
          <Label className="text-xs font-medium text-slate-700">Material Photo</Label>
          <div className="mt-1">
            <ItemPhotoUpload value={item.material_photo} onChange={v => onUpdate('material_photo', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}