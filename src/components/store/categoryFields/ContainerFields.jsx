import { Input } from '@/components/ui/input';

export default function ContainerFields({ form, setField }) {
  return (
    <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Container / Bottle Fields</p>

      {/* Container Type */}
      <div>
        <label className="text-xs font-medium text-slate-700">Container Type *</label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.sys_container_type || 'Glass Bottle'}
          onChange={e => setField('sys_container_type', e.target.value)}
        >
          <option value="Glass Bottle">Glass Bottle</option>
          <option value="Can">Can</option>
        </select>
      </div>

      {/* Volume per Container */}
      <div>
        <label className="text-xs font-medium text-slate-700">Volume per Container (ml) *</label>
        <Input
          className="h-9 text-sm mt-1"
          type="number"
          min="1"
          value={form.sys_ml_per_container || ''}
          onChange={e => setField('sys_ml_per_container', e.target.value)}
          placeholder="e.g. 250, 500, 1000"
        />
      </div>

      {/* Colour */}
      <div>
        <label className="text-xs font-medium text-slate-700">Container Colour *</label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.sys_colour || 'Transparent'}
          onChange={e => setField('sys_colour', e.target.value)}
        >
          <option value="Transparent">Transparent</option>
          <option value="Amber">Amber</option>
        </select>
      </div>

      {/* Vendor Nickname */}
      <div>
        <label className="text-xs font-medium text-slate-700">Vendor / Nickname *</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_vendor_nickname || ''}
          onChange={e => setField('sys_vendor_nickname', e.target.value)}
          placeholder="Vendor name or short identifier"
        />
      </div>

      {/* Bottles per Crate */}
      <div>
        <label className="text-xs font-medium text-slate-700">Bottles per Crate *</label>
        <Input
          className="h-9 text-sm mt-1"
          type="number"
          min="1"
          value={form.sys_bottles_per_crate || ''}
          onChange={e => setField('sys_bottles_per_crate', e.target.value)}
          placeholder="e.g. 24"
        />
      </div>
    </div>
  );
}

export function validateContainerFields(form) {
  if (!form.sys_ml_per_container || Number(form.sys_ml_per_container) < 1) {
    return 'Volume per Container (ml) is required (minimum 1)';
  }
  if (!form.sys_vendor_nickname?.trim()) return 'Vendor / Nickname is required';
  if (!form.sys_bottles_per_crate || Number(form.sys_bottles_per_crate) < 1) {
    return 'Bottles per Crate is required (minimum 1)';
  }
  return null;
}