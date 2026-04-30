import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import CreatableUOMSelect from '@/components/store/CreatableUOMSelect';
import IngredientFields, { validateIngredientFields } from '@/components/store/categoryFields/IngredientFields';
import BoxTypeFields, { validateBoxTypeFields } from '@/components/store/categoryFields/BoxTypeFields';
import CapTypeFields, { validateCapTypeFields } from '@/components/store/categoryFields/CapTypeFields';
import ContainerFields, { validateContainerFields } from '@/components/store/categoryFields/ContainerFields';
import FlavourFields, { validateFlavourFields } from '@/components/store/categoryFields/FlavourFields';
import LabelArtworkFields, { validateLabelArtworkFields } from '@/components/store/categoryFields/LabelArtworkFields';
import { Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import OpeningStockLocationSelect from '@/components/store/OpeningStockLocationSelect';

const ALL_CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient', systemEntity: 'IngredientMaster' },
  { value: 'box_type', label: 'Box Type', systemEntity: 'BoxType' },
  { value: 'cap_type', label: 'Cap Type', systemEntity: 'CapType' },
  { value: 'container', label: 'Container / Bottle', systemEntity: 'ContainerType' },
  { value: 'flavour', label: 'Flavour', systemEntity: 'FlavourMaster' },
  { value: 'label_artwork', label: 'Label Artwork', systemEntity: 'LabelArtwork' },
  { value: 'packaging', label: 'Packaging', systemEntity: null },
  { value: 'other', label: 'Other', systemEntity: null },
];

const CATEGORY_VALIDATORS = {
  ingredient: validateIngredientFields,
  box_type: validateBoxTypeFields,
  cap_type: validateCapTypeFields,
  container: validateContainerFields,
  flavour: validateFlavourFields,
  label_artwork: validateLabelArtworkFields,
};

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
  opening_stock_location_id: '',
  opening_stock_location_code: '',
  storage_notes: '',
  is_active: true,
};

/* ──────────────────────────────── System Master Creation ─────────────────────────────── */

async function createInSystemMaster(category, form, itemCode) {
  const catConfig = ALL_CATEGORIES.find(c => c.value === category);
  if (!catConfig?.systemEntity) return { source_entity: null, source_id: null };

  let systemRecord;

  switch (catConfig.systemEntity) {
    case 'IngredientMaster': {
      const existing = await base44.entities.IngredientMaster.list('ingredient_id', 1000);
      const maxNum = existing.reduce((max, i) => {
        const m = i.ingredient_id?.match(/^ING-(\d+)$/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      systemRecord = await base44.entities.IngredientMaster.create({
        ingredient_id: `ING-${String(maxNum + 1).padStart(5, '0')}`,
        ingredient_name: form.item_name.trim(),
        normalized_name: form.item_name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ''),
        group_id: form.sys_group_id,
        uom_id: form.uom || 'KG',
        allow_substitution: form.sys_allow_substitution !== false,
        notes: form.sys_notes || '',
        is_active: true,
      });
      break;
    }
    case 'BoxType': {
      const existing = await base44.entities.BoxType.list('box_type_id', 1000);
      const maxNum = existing.reduce((max, b) => {
        const m = b.box_type_id?.match(/^BOX-(\d+)$/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      systemRecord = await base44.entities.BoxType.create({
        box_type_id: `BOX-${String(maxNum + 1).padStart(6, '0')}`,
        box_code: form.sys_box_code || '',
        box_name: form.item_name.trim(),
        bottles_per_box: Number(form.sys_bottles_per_box) || 1,
        length_mm: form.sys_length_mm ? Number(form.sys_length_mm) : undefined,
        width_mm: form.sys_width_mm ? Number(form.sys_width_mm) : undefined,
        height_mm: form.sys_height_mm ? Number(form.sys_height_mm) : undefined,
        empty_weight_kg: form.sys_empty_weight_kg ? Number(form.sys_empty_weight_kg) : undefined,
        notes: form.sys_notes || '',
        is_active: true,
      });
      break;
    }
    case 'CapType': {
      const capCode = itemCode || `CAP-${Date.now().toString(36).toUpperCase()}`;
      systemRecord = await base44.entities.CapType.create({
        cap_sku_code: capCode,
        cap_name: form.item_name.trim(),
        cap_type: form.sys_cap_type,
        cap_colour: form.sys_cap_colour,
        cap_photo_url: form.material_photo || 'https://placehold.co/100x100?text=Cap',
        cap_nickname: form.sys_cap_nickname || '',
        is_active: true,
      });
      break;
    }
    case 'ContainerType': {
      const containerCode = itemCode || `CTN-${Date.now().toString(36).toUpperCase()}`;
      systemRecord = await base44.entities.ContainerType.create({
        container_code: containerCode,
        auto_generated_name: form.item_name.trim(),
        container_type: form.sys_container_type || 'Glass Bottle',
        ml_per_container: Number(form.sys_ml_per_container),
        colour: form.sys_colour || 'Transparent',
        vendor_nickname: form.sys_vendor_nickname?.trim(),
        bottles_per_crate: Number(form.sys_bottles_per_crate) || 1,
      });
      break;
    }
    case 'FlavourMaster': {
      systemRecord = await base44.entities.FlavourMaster.create({
        brand_name: form.sys_brand_name,
        family_name: form.sys_family_name,
        flavour_name: form.item_name.trim(),
        short_code: form.sys_short_code || '',
        is_active: true,
      });
      break;
    }
    case 'LabelArtwork': {
      const existing = await base44.entities.LabelArtwork.list('artwork_id', 1000);
      const maxNum = existing.reduce((max, a) => {
        const m = a.artwork_id?.match(/^ART-(\d+)$/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      systemRecord = await base44.entities.LabelArtwork.create({
        artwork_id: `ART-${String(maxNum + 1).padStart(5, '0')}`,
        artwork_name: form.item_name.trim(),
        artwork_version: form.sys_artwork_version || '',
        label_size: form.sys_label_size || '',
        preview_url: form.material_photo || '',
        version_notes: form.sys_version_notes || '',
        is_active: true,
      });
      break;
    }
    default:
      return { source_entity: null, source_id: null };
  }

  return { source_entity: catConfig.systemEntity, source_id: systemRecord.id };
}

/* ──────────────────────────────── Component ─────────────────────────────── */

export default function StoreItemForm({ onSaved, onCancel, userRole }) {
  const isStoreManager = userRole === 'store_manager';
  const CATEGORIES = isStoreManager
    ? ALL_CATEGORIES.filter(c => !c.systemEntity)
    : ALL_CATEGORIES;

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
    if (!form.item_name?.trim()) { setError('Enter item name first to generate code'); return; }
    setGeneratingCode(true);
    setAiAlternatives([]);
    const res = await base44.functions.invoke('generateItemCode', {
      item_name: form.item_name.trim(),
      item_category: form.item_category,
    });
    setForm(prev => ({ ...prev, item_code: res.data.item_code }));
    setAiAlternatives(res.data.alternatives || []);
    setGeneratingCode(false);
  }

  async function checkDuplicateName(name) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;
    const existing = await base44.entities.StoreItemMaster.list('item_name', 500);
    return existing.some(i => i.item_name?.trim().toLowerCase() === normalized);
  }

  async function handleSave() {
    if (!form.item_name?.trim()) { setError('Item name is required'); return; }
    if (!form.item_category) { setError('Category is required'); return; }

    // Validate category-specific mandatory fields
    const validator = CATEGORY_VALIDATORS[form.item_category];
    if (validator) {
      const catError = validator(form);
      if (catError) { setError(catError); return; }
    }

    // Cap Type requires photo (mandatory in CapType entity)
    if (form.item_category === 'cap_type' && !form.material_photo) {
      setError('Material Photo is required for Cap Type items');
      return;
    }

    setSaving(true);
    setError('');

    const isDuplicate = await checkDuplicateName(form.item_name);
    if (isDuplicate) {
      setError(`An item with the name "${form.item_name.trim()}" already exists. Please use a different name.`);
      setSaving(false);
      return;
    }

    let itemCode = form.item_code?.trim();
    if (!itemCode) {
      const res = await base44.functions.invoke('generateItemCode', {
        item_name: form.item_name.trim(),
        item_category: form.item_category,
      });
      itemCode = res.data.item_code;
    }

    const { source_entity, source_id } = await createInSystemMaster(form.item_category, form, itemCode);

    const openingQty = form.opening_stock !== '' ? Number(form.opening_stock) : 0;
    const hasLocation = !!form.opening_stock_location_id;

    // Auto-generate opening lot ID if qty > 0 and location assigned
    const openingLotId = (openingQty > 0 && hasLocation)
      ? `LOT-OPEN-${itemCode}-${Date.now().toString(36).toUpperCase()}`
      : undefined;

    const masterRecord = await base44.entities.StoreItemMaster.create({
      item_name: form.item_name.trim(),
      item_code: itemCode,
      item_category: form.item_category,
      uom: form.uom || 'Nos',
      material_photo: form.material_photo || '',
      batch_required: !!form.batch_required,
      expiry_required: !!form.expiry_required,
      mfg_date_required: !!form.mfg_date_required,
      opening_stock: openingQty,
      opening_stock_location_id: form.opening_stock_location_id || '',
      opening_stock_location_code: form.opening_stock_location_code || '',
      opening_lot_id: openingLotId || '',
      storage_notes: form.storage_notes || '',
      is_active: form.is_active,
      ...(source_entity && { source_entity }),
      ...(source_id && { source_id }),
    });

    // If opening stock > 0 and location is assigned → create lot + stock balance so it's issuable
    if (openingQty > 0 && hasLocation && openingLotId) {
      await base44.entities.StoreLot.create({
        lot_id: openingLotId,
        qr_code: openingLotId,
        item_code: itemCode,
        item_name: form.item_name.trim(),
        uom: form.uom || 'Nos',
        original_quantity: openingQty,
        quantity: openingQty,
        remaining_quantity: openingQty,
        mismatch_type: 'none',
        supplier_name: 'Opening Stock',
        status: 'putaway',
        notes: 'Auto-created from opening stock',
      });
      await base44.entities.StoreStockBalance.create({
        location_id: form.opening_stock_location_id,
        location_code: form.opening_stock_location_code,
        lot_id: openingLotId,
        item_code: itemCode,
        item_name: form.item_name.trim(),
        uom: form.uom || 'Nos',
        quantity: openingQty,
        putaway_date: new Date().toISOString(),
        putaway_by: 'system/opening-stock',
      });
    }

    setSaving(false);
    if (onSaved) onSaved(masterRecord);
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

      {!isStoreManager && hasSystemMaster && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          This item will be created in <strong>{selectedCat.systemEntity}</strong> first, then linked to Store Item Master.
        </div>
      )}

      {/* Item Name */}
      <div>
        <label className="text-xs font-medium text-slate-700">Item Name *</label>
        <Input className="h-9 md:h-9 text-sm mt-1" value={form.item_name} onChange={e => setField('item_name', e.target.value)} placeholder="Enter item name" />
      </div>

      {/* Category + Unit of Measure — placed early so category-specific fields appear below */}
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
          {!isStoreManager && hasSystemMaster && (
            <p className="text-xs text-blue-500 mt-0.5">Creates in {selectedCat.systemEntity}</p>
          )}
        </div>
        <div>
          <CreatableUOMSelect value={form.uom} onChange={v => setField('uom', v)} />
        </div>
      </div>

      {/* ── Dynamic Category-Specific Fields (hidden for store managers) ── */}
      {!isStoreManager && (
        <>
          {form.item_category === 'ingredient' && <IngredientFields form={form} setField={setField} />}
          {form.item_category === 'box_type' && <BoxTypeFields form={form} setField={setField} />}
          {form.item_category === 'cap_type' && <CapTypeFields form={form} setField={setField} />}
          {form.item_category === 'container' && <ContainerFields form={form} setField={setField} />}
          {form.item_category === 'flavour' && <FlavourFields form={form} setField={setField} />}
          {form.item_category === 'label_artwork' && <LabelArtworkFields form={form} setField={setField} />}
        </>
      )}

      {/* AI Item Code */}
      <div className="border border-slate-100 rounded-xl p-4 space-y-2 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700">Item Code</label>
          <button type="button" onClick={generateItemCode} disabled={generatingCode || !form.item_name?.trim()}
            className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
            {generatingCode ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate with AI</>}
          </button>
        </div>
        <div className="flex gap-2">
          <Input className="h-9 text-sm font-mono tracking-wide uppercase flex-1" value={form.item_code || ''}
            onChange={e => { setField('item_code', e.target.value.toUpperCase()); setAiAlternatives([]); }} placeholder="e.g. ING-SGR" />
          {form.item_code && (
            <button type="button" onClick={generateItemCode} disabled={generatingCode}
              className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors" title="Regenerate">
              <RefreshCw className={`w-3.5 h-3.5 ${generatingCode ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        {aiAlternatives.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500">Alternatives:</span>
            {aiAlternatives.map(alt => (
              <button key={alt} type="button"
                onClick={() => { setField('item_code', alt); setAiAlternatives(prev => prev.filter(a => a !== alt)); }}
                className="px-2 py-0.5 text-xs font-mono bg-white border border-slate-200 rounded-md hover:bg-teal-50 hover:border-teal-300 text-slate-700 transition-colors">
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
        required={form.item_category === 'cap_type'}
      />

      {/* Opening Stock */}
      <div>
        <label className="text-xs font-medium text-slate-700">Opening Stock</label>
        <Input className="h-9 text-sm mt-1" type="number" min="0" value={form.opening_stock}
          onChange={e => setField('opening_stock', e.target.value)} placeholder="0" />
        <p className="text-xs text-slate-400 mt-0.5">Initial stock quantity for this item (treated as current stock)</p>
      </div>

      {/* Opening Stock Location */}
      {Number(form.opening_stock) > 0 && (
        <OpeningStockLocationSelect
          locationId={form.opening_stock_location_id}
          locationCode={form.opening_stock_location_code}
          onChange={({ location_id, location_code }) => {
            setField('opening_stock_location_id', location_id);
            setField('opening_stock_location_code', location_code);
          }}
        />
      )}

      {/* Validation Rules */}
      <div className="border border-slate-100 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-600 mb-2">Validation Rules</p>
        {[
          { key: 'batch_required', label: 'Batch Number Required' },
          { key: 'expiry_required', label: 'Expiry Date Required' },
          { key: 'mfg_date_required', label: 'Manufacture Date Required' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={!!form[key]} onChange={e => setField(key, e.target.checked)} />
            <span className="text-sm text-slate-700">{label}</span>
          </label>
        ))}
      </div>

      {/* Storage Notes */}
      <div>
        <label className="text-xs font-medium text-slate-700">Storage Notes</label>
        <textarea rows={2} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none"
          value={form.storage_notes || ''} onChange={e => setField('storage_notes', e.target.value)} placeholder="Optional storage instructions" />
      </div>

      {/* Active */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 rounded" checked={!!form.is_active} onChange={e => setField('is_active', e.target.checked)} />
        <span className="text-sm text-slate-700">Active</span>
      </label>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1 h-11 text-sm">Cancel</Button>
        )}
        <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 bg-slate-900 text-sm gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Creating…' : 'Create Item'}
        </Button>
      </div>
    </div>
  );
}