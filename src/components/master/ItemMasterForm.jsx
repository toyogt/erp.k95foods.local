import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft } from 'lucide-react';

const CATEGORY_CONFIGS = {
  INGREDIENT: {
    label: 'Ingredient',
    fields: [
      { key: 'group_id', label: 'Ingredient Group', type: 'text', placeholder: 'e.g., FLAVOUR, SWEETENER' },
      { key: 'allow_substitution', label: 'Allow Substitution', type: 'checkbox' },
      { key: 'brand', label: 'Brand', type: 'text' },
      { key: 'supplier_name', label: 'Supplier Name', type: 'text' },
    ]
  },
  CONTAINER: {
    label: 'Container',
    fields: [
      { key: 'container_type', label: 'Container Type', type: 'select', options: ['Glass Bottle', 'Can', 'PET Bottle'] },
      { key: 'ml_per_container', label: 'Volume (ml)', type: 'number' },
      { key: 'colour', label: 'Colour', type: 'select', options: ['Transparent', 'Amber', 'Green', 'Blue'] },
      { key: 'vendor_nickname', label: 'Vendor Nickname', type: 'text' },
      { key: 'bottles_per_crate', label: 'Bottles per Crate', type: 'number' },
      { key: 'datasheet_url', label: 'Datasheet URL', type: 'text' },
    ]
  },
  CAP: {
    label: 'Cap/Closure',
    fields: [
      { key: 'cap_type_name', label: 'Cap Type', type: 'text', placeholder: 'e.g., Crown Cap, Flip-Top' },
      { key: 'neck_size', label: 'Neck Size (mm)', type: 'number' },
      { key: 'colour', label: 'Colour', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
    ]
  },
  PACKAGING_BOX: {
    label: 'Packaging Box',
    fields: [
      { key: 'bottles_per_box', label: 'Bottles per Box', type: 'number' },
      { key: 'length_mm', label: 'Length (mm)', type: 'number' },
      { key: 'width_mm', label: 'Width (mm)', type: 'number' },
      { key: 'height_mm', label: 'Height (mm)', type: 'number' },
      { key: 'empty_weight_kg', label: 'Empty Weight (kg)', type: 'number' },
    ]
  },
  CONSUMABLE: {
    label: 'Consumable',
    fields: [
      { key: 'consumable_type', label: 'Type', type: 'text', placeholder: 'e.g., Label, Sticker, Carton' },
      { key: 'supplier_name', label: 'Supplier', type: 'text' },
    ]
  },
};

export default function ItemMasterForm({ user, item, onDone, onCancel }) {
  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    category: 'INGREDIENT',
    base_uom: '',
    barcode: '',
    is_active: true,
    notes: '',
  });
  const [specifications, setSpecifications] = useState({});
  const [loading, setLoading] = useState(false);
  const [uoms, setUoms] = useState([]);

  useEffect(() => {
    base44.entities.UOMMaster.list('uom_name', 200).then(setUoms).catch(() => {});
    if (item) {
      setFormData({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        category: item.category || 'INGREDIENT',
        base_uom: item.base_uom || '',
        barcode: item.barcode || '',
        is_active: item.is_active ?? true,
        notes: item.notes || '',
      });
      setSpecifications(item.specifications || {});
    }
  }, [item]);

  function updateField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function updateSpec(key, value) {
    setSpecifications(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!formData.item_code || !formData.item_name || !formData.category || !formData.base_uom) {
      alert('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        specifications,
      };
      if (item) {
        await base44.entities.ItemMaster.update(item.id, payload);
      } else {
        await base44.entities.ItemMaster.create(payload);
      }
      onDone();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  }

  const config = CATEGORY_CONFIGS[formData.category] || CATEGORY_CONFIGS.INGREDIENT;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">{item ? 'Edit Item' : 'Add New Item'}</h2>
        <Button variant="outline" onClick={onCancel} className="h-9">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Basic Fields */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Item Code *</label>
            <input
              type="text"
              value={formData.item_code}
              onChange={e => updateField('item_code', e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1"
              placeholder="e.g., ING-SUGAR-001"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Item Name *</label>
            <input
              type="text"
              value={formData.item_name}
              onChange={e => updateField('item_name', e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1"
              placeholder="Display name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Category *</label>
            <select
              value={formData.category}
              onChange={e => updateField('category', e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1 bg-white"
            >
              <option value="INGREDIENT">Ingredient</option>
              <option value="CONTAINER">Container</option>
              <option value="CAP">Cap/Closure</option>
              <option value="PACKAGING_BOX">Packaging Box</option>
              <option value="CONSUMABLE">Consumable</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Base UOM *</label>
            <select
              value={formData.base_uom}
              onChange={e => updateField('base_uom', e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1 bg-white"
            >
              <option value="">Select...</option>
              {uoms.map(u => <option key={u.id} value={u.uom_id}>{u.uom_name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">Barcode</label>
          <input
            type="text"
            value={formData.barcode}
            onChange={e => updateField('barcode', e.target.value)}
            className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Category-Specific Specifications */}
      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{config.label} Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.fields.map(field => (
            <div key={field.key}>
              <label className="text-xs font-medium text-slate-700">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={specifications[field.key] || ''}
                  onChange={e => updateSpec(field.key, e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1 bg-white"
                >
                  <option value="">Select...</option>
                  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={specifications[field.key] || false}
                    onChange={e => updateSpec(field.key, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-200"
                  />
                  <span className="text-xs text-slate-500">Yes</span>
                </div>
              ) : (
                <input
                  type={field.type}
                  value={specifications[field.key] || ''}
                  onChange={e => updateSpec(field.key, e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 rounded-lg text-sm mt-1"
                  placeholder={field.placeholder || ''}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-slate-700">Notes</label>
        <textarea
          value={formData.notes}
          onChange={e => updateField('notes', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1"
          rows={3}
          placeholder="Optional notes..."
        />
      </div>

      {/* Active Status */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.is_active}
          onChange={e => updateField('is_active', e.target.checked)}
          className="w-4 h-4 rounded border-slate-200"
        />
        <label className="text-sm text-slate-700">Active</label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-11">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (item ? 'Update Item' : 'Create Item')}
        </Button>
      </div>
    </div>
  );
}