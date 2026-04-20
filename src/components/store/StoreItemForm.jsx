import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import CreatableUOMSelect from '@/components/store/CreatableUOMSelect';
import { Loader2, Sparkles, RefreshCw, Check } from 'lucide-react';

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
  item_code: '',
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
  const [generatingCode, setGeneratingCode] = useState(false);
  const [aiAlternatives, setAiAlternatives] = useState([]);

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
    if (error) setError('');
  }

  async function generateItemCode() {
    if (!form.item_name?.trim()) {
      setError('Enter item name first to generate code');
      return;
    }
    setGeneratingCode(true);
    setAiAlternatives([]);
    const res = await base44.functions.invoke('generateItemCode', {
      item_name: form.item_name.trim(),
      item_category: form.item_category,
    });
    const { item_code, alternatives } = res.data;
    setForm(prev => ({ ...prev, item_code: item_code }));
    setAiAlternatives(alternatives || []);
    setGeneratingCode(false);
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

    // Auto-generate item code if not set
    let itemCode = form.item_code?.trim();
    if (!itemCode) {
      const res = await base44.functions.invoke('generateItemCode', {
        item_name: form.item_name.trim(),
        item_category: form.item_category,
      });
      itemCode = res.data.item_code;
    }

    const data = {
      ...form,
      item_name: form.item_name.trim(),
      item_code: itemCode,
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

      {/* AI Item Code */}
      <div className="border border-slate-100 rounded-xl p-4 space-y-2 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700">Item Code</label>
          <button
            type="button"
            onClick={generateItemCode}
            disabled={generatingCode || !form.item_name?.trim()}
            className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {generatingCode ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Generate with AI</>
            )}
          </button>
        </div>
        <div className="flex gap-2">
          <Input
            className="h-9 text-sm font-mono tracking-wide uppercase flex-1"
            value={form.item_code || ''}
            onChange={e => {
              setField('item_code', e.target.value.toUpperCase());
              setAiAlternatives([]);
            }}
            placeholder="e.g. ING-SGR"
          />
          {form.item_code && (
            <button
              type="button"
              onClick={generateItemCode}
              disabled={generatingCode}
              className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
              title="Regenerate"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingCode ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        {aiAlternatives.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500">Alternatives:</span>
            {aiAlternatives.map(alt => (
              <button
                key={alt}
                type="button"
                onClick={() => {
                  setField('item_code', alt);
                  setAiAlternatives(prev => prev.filter(a => a !== alt));
                }}
                className="px-2 py-0.5 text-xs font-mono bg-white border border-slate-200 rounded-md hover:bg-teal-50 hover:border-teal-300 text-slate-700 transition-colors"
              >
                {alt}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">AI generates a short, meaningful code. You can edit it manually.</p>
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