import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import NumericInput from '@/components/ui/NumericInput';
import ItemSelectWithStock from './ItemSelectWithStock';
import { UNITS } from './purchaseHelpers';

export default function PRItemRowEnhanced({ item, index, ingredients, uoms, onUpdate, onRemove, canRemove, onItemAdded }) {
  const [uploading, setUploading] = useState(false);

  const unitOptions = [
    ...UNITS.map(u => ({ code: u, name: u })),
    ...uoms.filter(u => !UNITS.includes(u.uom_code?.toLowerCase()) && !UNITS.includes(u.uom_name?.toLowerCase()))
      .map(u => ({ code: u.uom_code || u.uom_name, name: u.uom_name })),
  ];

  async function handleSampleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUpdate({ sample_image: file_url });
    setUploading(false);
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
        {canRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>}
      </div>

      <div>
        <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
        <div className="mt-1">
          <ItemSelectWithStock
            ingredients={ingredients}
            value={{ item_code: item.item_code, item_name: item.item_name }}
            onSelect={sel => onUpdate({ item_code: sel.item_code, item_name: sel.item_name, unit: sel.unit || item.unit })}
            onManualEntry={sel => { onUpdate({ item_code: '', item_name: sel.item_name }); if (onItemAdded) onItemAdded({ item_name: sel.item_name }); }}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-slate-700">Description / Specifications</Label>
        <input className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={item.description || ''} onChange={e => onUpdate({ description: e.target.value })} placeholder="Optional specifications" />
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
            {unitOptions.map(u => <option key={u.code} value={u.code}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Estimated Rate</Label>
          <NumericInput className="h-11 md:h-9 text-sm mt-1" value={item.estimated_rate || ''} onChange={e => onUpdate({ estimated_rate: e.target.value })} placeholder="₹" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="text-xs font-medium text-slate-700">Sample Image</Label>
          <div className="flex items-center gap-2 mt-1">
            {item.sample_image ? (
              <a href={item.sample_image} target="_blank" rel="noopener noreferrer">
                <img src={item.sample_image} alt="Sample" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
              </a>
            ) : null}
            <label className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:bg-slate-50">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? 'Uploading...' : item.sample_image ? 'Replace' : 'Upload'}
              <input type="file" accept="image/*" className="hidden" onChange={handleSampleUpload} disabled={uploading} />
            </label>
          </div>
        </div>
        <div className="flex-1">
          <Label className="text-xs font-medium text-slate-700">Remarks</Label>
          <input className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={item.remarks || ''} onChange={e => onUpdate({ remarks: e.target.value })} placeholder="Optional" />
        </div>
      </div>
    </div>
  );
}