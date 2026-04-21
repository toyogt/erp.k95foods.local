import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function CapTypeFields({ form, setField }) {
  const [capTypes, setCapTypes] = useState([]);
  const [capColours, setCapColours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.CapTypeMaster.filter({ is_active: true }, 'sort_order', 200).catch(() => []),
      base44.entities.CapColourMaster.filter({ is_active: true }, 'sort_order', 200).catch(() => []),
    ]).then(([types, colours]) => {
      setCapTypes(types);
      setCapColours(colours);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading cap configuration…
      </div>
    );
  }

  return (
    <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Cap Type Fields</p>

      {/* Cap Type */}
      <div>
        <label className="text-xs font-medium text-slate-700">Cap Type *</label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.sys_cap_type || ''}
          onChange={e => setField('sys_cap_type', e.target.value)}
        >
          <option value="">Select cap type…</option>
          {capTypes.map(t => (
            <option key={t.id} value={t.cap_type_name}>{t.cap_type_name}</option>
          ))}
        </select>
      </div>

      {/* Cap Colour */}
      <div>
        <label className="text-xs font-medium text-slate-700">Cap Colour *</label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.sys_cap_colour || ''}
          onChange={e => setField('sys_cap_colour', e.target.value)}
        >
          <option value="">Select colour…</option>
          {capColours.map(c => (
            <option key={c.id} value={c.colour_name}>{c.colour_name}</option>
          ))}
        </select>
      </div>

      {/* Cap Nickname */}
      <div>
        <label className="text-xs font-medium text-slate-700">Cap Nickname / Vendor Reference</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_cap_nickname || ''}
          onChange={e => setField('sys_cap_nickname', e.target.value)}
          placeholder="e.g. Vendor short name"
        />
      </div>
    </div>
  );
}

export function validateCapTypeFields(form) {
  if (!form.sys_cap_type) return 'Cap Type is required';
  if (!form.sys_cap_colour) return 'Cap Colour is required';
  return null;
}