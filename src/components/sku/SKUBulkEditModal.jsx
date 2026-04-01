import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BULK_FIELDS = [
  { key: 'brand_name',     label: 'Brand Name',    type: 'select', optionProp: 'brands',    optionKey: 'brand_name' },
  { key: 'product_family', label: 'Product Family', type: 'select', optionProp: 'families',  optionKey: 'family_name' },
  { key: 'flavour',        label: 'Flavour',        type: 'select', optionProp: 'flavours',  optionKey: 'flavour_name' },
  { key: 'cap_sku_code',   label: 'Cap Type',       type: 'select', optionProp: 'capTypes',  optionKey: 'cap_sku_code', labelKey: 'cap_name' },
  { key: 'box_type_id',    label: 'Box Type',       type: 'select', optionProp: 'boxTypes',  optionKey: 'box_type_id', labelKey: 'box_name' },
  { key: 'shelf_life_days',label: 'Shelf Life (days)', type: 'number' },
  { key: 'gross_weight_kg',label: 'Gross Weight (kg)',  type: 'number' },
  { key: 'fssai_no',       label: 'FSSAI Number',   type: 'text' },
  { key: 'is_active',      label: 'Status',         type: 'boolean' },
];

export default function SKUBulkEditModal({ open, onClose, selectedSkus, brands, families, flavours, capTypes, boxTypes, onSaved }) {
  const { toast } = useToast();
  const [changes, setChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const options = { brands, families, flavours, capTypes, boxTypes };

  function setValue(key, val) {
    setChanges(prev => ({ ...prev, [key]: val }));
  }

  function clearField(key) {
    setChanges(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function handleSave() {
    if (Object.keys(changes).length === 0) {
      toast({ title: 'No changes selected', description: 'Select at least one field to update.' });
      return;
    }
    setSaving(true);
    await Promise.all(selectedSkus.map(sku => base44.entities.ProductMaster.update(sku.id, changes)));
    const updated = selectedSkus.length;
    setSaving(false);
    toast({ title: `Updated ${updated} Product Code${updated > 1 ? 's' : ''}` });
    setChanges({});
    onSaved();
    onClose();
  }

  const changedCount = Object.keys(changes).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit — {selectedSkus.length} Product Code{selectedSkus.length > 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected SKUs */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Selected Product Codes:</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedSkus.map(s => (
                <span key={s.id} className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                  {s.item_code}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">Select only the fields you want to change. Unchecked fields will not be modified.</p>

          {/* Field list */}
          <div className="space-y-3">
            {BULK_FIELDS.map(field => {
              const isEnabled = field.key in changes;
              return (
                <div key={field.key} className={`border rounded-lg p-3 transition-colors ${isEnabled ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={e => e.target.checked ? setValue(field.key, field.type === 'boolean' ? true : '') : clearField(field.key)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <Label className="text-sm font-medium text-slate-700 flex-1">{field.label}</Label>
                    {isEnabled && (
                      <span className="text-xs text-blue-600 font-semibold">Will update</span>
                    )}
                  </div>

                  {isEnabled && (
                    <div className="mt-2 ml-7">
                      {field.type === 'select' && (
                        <select
                          value={changes[field.key] || ''}
                          onChange={e => setValue(field.key, e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-9 bg-white"
                        >
                          <option value="">— Select —</option>
                          {(options[field.optionProp] || []).map(o => (
                            <option key={o[field.optionKey]} value={o[field.optionKey]}>
                              {field.labelKey ? o[field.labelKey] : o[field.optionKey]}
                            </option>
                          ))}
                        </select>
                      )}
                      {(field.type === 'text' || field.type === 'number') && (
                        <Input
                          type={field.type === 'number' ? 'number' : 'text'}
                          className="h-9 text-sm"
                          value={changes[field.key] || ''}
                          onChange={e => setValue(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                          placeholder={`Enter ${field.label}`}
                        />
                      )}
                      {field.type === 'boolean' && (
                        <div className="flex gap-3">
                          {[{ val: true, label: 'Active' }, { val: false, label: 'Inactive' }].map(opt => (
                            <button
                              key={String(opt.val)}
                              type="button"
                              onClick={() => setValue(field.key, opt.val)}
                              className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                                changes[field.key] === opt.val
                                  ? opt.val ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-500 bg-slate-100 text-slate-700'
                                  : 'border-slate-200 bg-white text-slate-500'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {changedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <strong>{changedCount} field{changedCount > 1 ? 's' : ''}</strong> will be updated across <strong>{selectedSkus.length} Product Code{selectedSkus.length > 1 ? 's' : ''}</strong>. This action cannot be undone.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              className="flex-1 h-11 bg-slate-900 text-white"
              onClick={handleSave}
              disabled={saving || changedCount === 0}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Apply to {selectedSkus.length} Product Code{selectedSkus.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}