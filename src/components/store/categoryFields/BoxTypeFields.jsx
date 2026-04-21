import { Input } from '@/components/ui/input';

export default function BoxTypeFields({ form, setField }) {
  return (
    <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Box Type Fields</p>

      {/* Bottles per Box */}
      <div>
        <label className="text-xs font-medium text-slate-700">Bottles per Box *</label>
        <Input
          className="h-9 text-sm mt-1"
          type="number"
          min="1"
          value={form.sys_bottles_per_box || ''}
          onChange={e => setField('sys_bottles_per_box', e.target.value)}
          placeholder="e.g. 6, 12, 24"
        />
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-700">Length (mm)</label>
          <Input
            className="h-9 text-sm mt-1"
            type="number"
            min="0"
            value={form.sys_length_mm || ''}
            onChange={e => setField('sys_length_mm', e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Width (mm)</label>
          <Input
            className="h-9 text-sm mt-1"
            type="number"
            min="0"
            value={form.sys_width_mm || ''}
            onChange={e => setField('sys_width_mm', e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Height (mm)</label>
          <Input
            className="h-9 text-sm mt-1"
            type="number"
            min="0"
            value={form.sys_height_mm || ''}
            onChange={e => setField('sys_height_mm', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Empty Weight */}
      <div>
        <label className="text-xs font-medium text-slate-700">Empty Weight (kg)</label>
        <Input
          className="h-9 text-sm mt-1"
          type="number"
          min="0"
          step="0.01"
          value={form.sys_empty_weight_kg || ''}
          onChange={e => setField('sys_empty_weight_kg', e.target.value)}
          placeholder="0.00"
        />
      </div>

      {/* Box Code */}
      <div>
        <label className="text-xs font-medium text-slate-700">Box Code</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_box_code || ''}
          onChange={e => setField('sys_box_code', e.target.value)}
          placeholder="e.g. BX6-250 (optional)"
        />
        <p className="text-xs text-slate-500 mt-0.5">Short code for quick identification</p>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-slate-700">Notes</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_notes || ''}
          onChange={e => setField('sys_notes', e.target.value)}
          placeholder="Optional notes"
        />
      </div>
    </div>
  );
}

export function validateBoxTypeFields(form) {
  if (!form.sys_bottles_per_box || Number(form.sys_bottles_per_box) < 1) {
    return 'Bottles per Box is required (minimum 1)';
  }
  return null;
}