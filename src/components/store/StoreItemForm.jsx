import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import CreatableUOMSelect from '@/components/store/CreatableUOMSelect';
import { Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'box_type', label: 'Box Type' },
  { value: 'cap_type', label: 'Cap Type' },
  { value: 'container', label: 'Container / Bottle' },
  { value: 'flavour', label: 'Flavour' },
  { value: 'label_artwork', label: 'Label Artwork' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  item_name: '',
  item_category: 'other',
  uom: '',
  material_photo: '',
  batch_required: false,
  expiry_required: false,
  mfg_date_required: false,
  opening_stock: '',
  storage_notes: '',
  is_active: true,
};

export default function StoreItemForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
    if (error) setError('');
  }

  async function handleSave() {
    if (!form.item_name?.trim()) {
      setError('Item name is required');
      return;
    }
    if (!form.item_category) {
      setError('Category is required');
      return;
    }
    setSaving(true);
    const data = {
      ...form,
      item_name: form.item_name.trim(),
      opening_stock: form.opening_stock !== '' ? Number(form.opening_stock) : 0,
    };
    await base44.entities.StoreItemMaster.create(data);
    setSaving(false);
    if (onSaved) onSaved();
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Item Name */}
      <div>
        <label className="text-xs font-medium text-slate-700">Item Name *</label>
        <Input
          className="h-9 md:h-9 text-sm mt-1"
          value={form.item_name}
          onChange={e => setField('item_name', e.target.value)}
          placeholder="Enter item name"
        />
      </div>

      {/* Photo */}
      <MaterialPhotoUpload
        value={form.material_photo}
        onChange={v => setField('material_photo', v)}
      />

      {/* Category + UOM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Category *</label>
          <select
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
            value={form.item_category}
            onChange={e => setField('item_category', e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <CreatableUOMSelect
            value={form.uom}
            onChange={v => setField('uom', v)}
          />
        </div>
      </div>

      {/* Opening Stock */}
      <div>
        <label className="text-xs font-medium text-slate-700">Opening Stock</label>
        <Input
          className="h-9 text-sm mt-1"
          type="number"
          min="0"
          value={form.opening_stock}
          onChange={e => setField('opening_stock', e.target.value)}
          placeholder="0"
        />
        <p className="text-xs text-slate-400 mt-0.5">Initial stock quantity for this item</p>
      </div>

      {/* Validation Rules */}
      <div className="border border-slate-100 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-600 mb-2">Validation Rules</p>
        {[
          { key: 'batch_required', label: 'Batch Number Required' },
          { key: 'expiry_required', label: 'Expiry Date Required' },
          { key: 'mfg_date_required', label: 'Manufacture Date Required' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded"
              checked={!!form[key]}
              onChange={e => setField(key, e.target.checked)}
            />
            <span className="text-sm text-slate-700">{label}</span>
          </label>
        ))}
      </div>

      {/* Storage Notes */}
      <div>
        <label className="text-xs font-medium text-slate-700">Storage Notes</label>
        <textarea
          rows={2}
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none"
          value={form.storage_notes || ''}
          onChange={e => setField('storage_notes', e.target.value)}
          placeholder="Optional storage instructions"
        />
      </div>

      {/* Active */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded"
          checked={!!form.is_active}
          onChange={e => setField('is_active', e.target.checked)}
        />
        <span className="text-sm text-slate-700">Active</span>
      </label>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1 h-11 text-sm">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 h-11 bg-slate-900 text-sm gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Create Item'}
        </Button>
      </div>
    </div>
  );
}