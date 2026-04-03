import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';

const ALL_CATEGORIES = [
  { key: 'INGREDIENT', label: 'Ingredients', description: 'Raw materials like sugar, syrup, flavours, preservatives' },
  { key: 'CONTAINER', label: 'Containers (Bottles)', description: 'PET bottles, glass bottles, and other containers' },
  { key: 'CAP', label: 'Caps', description: 'Bottle caps and closures' },
  { key: 'PACKAGING_BOX', label: 'Packaging Boxes', description: 'Corrugated boxes, shippers, cartons' },
  { key: 'CONSUMABLE', label: 'Consumables', description: 'Labels, shrink wraps, adhesives, and other consumables' },
];

export default function MaterialCategoryConfig({ planningCategories, onSaved }) {
  const [saving, setSaving] = useState(null);

  const isEnabled = (key) => {
    const cat = planningCategories.find(c => c.category_key === key);
    return cat?.is_active === true;
  };

  const getRecord = (key) => planningCategories.find(c => c.category_key === key);

  const toggleCategory = async (cat) => {
    setSaving(cat.key);
    const existing = getRecord(cat.key);
    if (existing) {
      await base44.entities.MaterialPlanningCategory.update(existing.id, {
        is_active: !existing.is_active,
      });
    } else {
      await base44.entities.MaterialPlanningCategory.create({
        category_key: cat.key,
        category_label: cat.label,
        is_active: true,
      });
    }
    setSaving(null);
    onSaved?.();
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Material Categories for Planning</h3>
        <p className="text-xs text-slate-500">Choose which types of materials should be included in production-driven material planning.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ALL_CATEGORIES.map(cat => {
          const enabled = isEnabled(cat.key);
          const isSaving = saving === cat.key;

          return (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat)}
              disabled={isSaving}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                enabled
                  ? 'border-green-300 bg-green-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${enabled ? 'text-green-800' : 'text-slate-700'}`}>
                    {cat.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  enabled ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : enabled ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        Enabled categories will be used when calculating material requirements from SKU production plans.
      </p>
    </div>
  );
}