import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import CreatableUOMSelect from '@/components/store/CreatableUOMSelect';
import { Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient', systemEntity: 'IngredientMaster' },
  { value: 'box_type', label: 'Box Type', systemEntity: 'BoxType' },
  { value: 'cap_type', label: 'Cap Type', systemEntity: 'CapType' },
  { value: 'container', label: 'Container / Bottle', systemEntity: 'ContainerType' },
  { value: 'flavour', label: 'Flavour', systemEntity: 'FlavourMaster' },
  { value: 'label_artwork', label: 'Label Artwork', systemEntity: 'LabelArtwork' },
  { value: 'packaging', label: 'Packaging', systemEntity: null },
  { value: 'other', label: 'Other', systemEntity: null },
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

/**
 * Creates the item in the appropriate System Master entity first,
 * then creates a linked StoreItemMaster record.
 * For categories without a system master (packaging, other), creates directly in StoreItemMaster.
 */
async function createInSystemMaster(category, form, itemCode) {
  const catConfig = CATEGORIES.find(c => c.value === category);
  
  if (!catConfig?.systemEntity) {
    // No system master — create directly in StoreItemMaster
    return { source_entity: null, source_id: null };
  }

  const entityName = catConfig.systemEntity;
  let systemRecord;

  switch (entityName) {
    case 'IngredientMaster': {
      // Generate a unique ingredient_id
      const existing = await base44.entities.IngredientMaster.list('ingredient_id', 1000);
      const maxNum = existing.reduce((max, i) => {
        const match = i.ingredient_id?.match(/^ING-(\d+)$/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const ingredientId = `ING-${String(maxNum + 1).padStart(5, '0')}`;

      // Find a default group_id (first active group) or use 'GEN'
      const groups = await base44.entities.IngredientGroup.list('group_name', 10);
      const defaultGroup = groups[0]?.group_id || 'GEN';

      systemRecord = await base44.entities.IngredientMaster.create({
        ingredient_id: ingredientId,
        ingredient_name: form.item_name.trim(),
        normalized_name: form.item_name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ''),
        group_id: defaultGroup,
        uom_id: form.uom || 'KG',
        is_active: true,
      });
      break;
    }
    case 'BoxType': {
      const existing = await base44.entities.BoxType.list('box_type_id', 1000);
      const maxNum = existing.reduce((max, b) => {
        const match = b.box_type_id?.match(/^BOX-(\d+)$/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const boxTypeId = `BOX-${String(maxNum + 1).padStart(6, '0')}`;

      systemRecord = await base44.entities.BoxType.create({
        box_type_id: boxTypeId,
        box_name: form.item_name.trim(),
        bottles_per_box: 1,
        is_active: true,
      });
      break;
    }
    case 'CapType': {
      const capCode = itemCode || `CAP-${Date.now().toString(36).toUpperCase()}`;
      systemRecord = await base44.entities.CapType.create({
        cap_sku_code: capCode,
        cap_name: form.item_name.trim(),
        cap_type: 'Standard',
        cap_colour: 'Not Specified',
        cap_photo_url: form.material_photo || 'https://placehold.co/100x100?text=Cap',
        is_active: true,
      });
      break;
    }
    case 'ContainerType': {
      const containerCode = itemCode || `CTN-${Date.now().toString(36).toUpperCase()}`;
      systemRecord = await base44.entities.ContainerType.create({
        container_code: containerCode,
        auto_generated_name: form.item_name.trim(),
        container_type: 'Glass Bottle',
        ml_per_container: 1,
        colour: 'Transparent',
        vendor_nickname: form.item_name.trim(),
        bottles_per_crate: 1,
      });
      break;
    }
    case 'FlavourMaster': {
      systemRecord = await base44.entities.FlavourMaster.create({
        brand_name: 'General',
        family_name: 'General',
        flavour_name: form.item_name.trim(),
        is_active: true,
      });
      break;
    }
    case 'LabelArtwork': {
      const existing = await base44.entities.LabelArtwork.list('artwork_id', 1000);
      const maxNum = existing.reduce((max, a) => {
        const match = a.artwork_id?.match(/^ART-(\d+)$/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const artworkId = `ART-${String(maxNum + 1).padStart(5, '0')}`;

      systemRecord = await base44.entities.LabelArtwork.create({
        artwork_id: artworkId,
        artwork_name: form.item_name.trim(),
        is_active: true,
      });
      break;
    }
    default:
      return { source_entity: null, source_id: null };
  }

  return {
    source_entity: entityName,
    source_id: systemRecord.id,
  };
}

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

  async function checkDuplicateName(name) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;
    const existing = await base44.entities.StoreItemMaster.list('item_name', 500);
    return existing.some(i => i.item_name?.trim().toLowerCase() === normalized);
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
    setError('');

    // Check for duplicate item name
    const isDuplicate = await checkDuplicateName(form.item_name);
    if (isDuplicate) {
      setError(`An item with the name "${form.item_name.trim()}" already exists. Please use a different name.`);
      setSaving(false);
      return;
    }

    // Auto-generate item code if not set
    let itemCode = form.item_code?.trim();
    if (!itemCode) {
      const res = await base44.functions.invoke('generateItemCode', {
        item_name: form.item_name.trim(),
        item_category: form.item_category,
      });
      itemCode = res.data.item_code;
    }

    // Step 1: Create in System Master (for categories that have one)
    const { source_entity, source_id } = await createInSystemMaster(
      form.item_category,
      form,
      itemCode
    );

    // Step 2: Create linked StoreItemMaster record
    const storeData = {
      item_name: form.item_name.trim(),
      item_code: itemCode,
      item_category: form.item_category,
      uom: form.uom || 'Nos',
      material_photo: form.material_photo || '',
      batch_required: !!form.batch_required,
      expiry_required: !!form.expiry_required,
      mfg_date_required: !!form.mfg_date_required,
      opening_stock: form.opening_stock !== '' ? Number(form.opening_stock) : 0,
      storage_notes: form.storage_notes || '',
      is_active: form.is_active,
      ...(source_entity && { source_entity }),
      ...(source_id && { source_id }),
    };

    await base44.entities.StoreItemMaster.create(storeData);

    setSaving(false);
    if (onSaved) onSaved();
  }

  const selectedCat = CATEGORIES.find(c => c.value === form.item_category);
  const hasSystemMaster = !!selectedCat?.systemEntity;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* System Master Info Banner */}
      {hasSystemMaster && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          This item will be created in <strong>{selectedCat.systemEntity}</strong> (System Master) first, then automatically linked to Store Item Master.
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
          {hasSystemMaster && (
            <p className="text-xs text-blue-500 mt-0.5">Creates in {selectedCat.systemEntity}</p>
          )}
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
          {saving ? 'Creating…' : 'Create Item'}
        </Button>
      </div>
    </div>
  );
}