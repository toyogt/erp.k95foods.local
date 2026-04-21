import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function IngredientFields({ form, setField }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.IngredientGroup.filter({ is_active: true }, 'group_name', 200)
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Ingredient Master Fields</p>

      {/* Ingredient Group */}
      <div>
        <label className="text-xs font-medium text-slate-700">Ingredient Group *</label>
        {loading ? (
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading groups…
          </div>
        ) : (
          <select
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
            value={form.sys_group_id || ''}
            onChange={e => setField('sys_group_id', e.target.value)}
          >
            <option value="">Select group…</option>
            {groups.map(g => (
              <option key={g.group_id} value={g.group_id}>
                {g.group_name} ({g.group_code})
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-slate-500 mt-0.5">Category group for this ingredient (e.g. Flavour, Acid, Sweetener)</p>
      </div>

      {/* Allow Substitution */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded"
          checked={form.sys_allow_substitution !== false}
          onChange={e => setField('sys_allow_substitution', e.target.checked)}
        />
        <span className="text-sm text-slate-700">Allow Substitution in Recipes</span>
      </label>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-slate-700">Ingredient Notes</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_notes || ''}
          onChange={e => setField('sys_notes', e.target.value)}
          placeholder="Optional notes about this ingredient"
        />
      </div>
    </div>
  );
}

export function validateIngredientFields(form) {
  if (!form.sys_group_id) return 'Ingredient Group is required';
  return null;
}