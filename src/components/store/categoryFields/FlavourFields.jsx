import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function FlavourFields({ form, setField }) {
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.BrandMaster.filter({ is_active: true }, 'brand_name', 200).catch(() => []),
      base44.entities.ProductFamilyMaster.filter({ is_active: true }, 'family_name', 200).catch(() => []),
    ]).then(([b, f]) => {
      setBrands(b);
      setFamilies(f);
      setLoading(false);
    });
  }, []);

  // Filter families by selected brand
  const filteredFamilies = form.sys_brand_name
    ? families.filter(f => f.brand_name === form.sys_brand_name)
    : families;

  if (loading) {
    return (
      <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading brand & family data…
      </div>
    );
  }

  return (
    <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Flavour Master Fields</p>

      {/* Brand */}
      <div>
        <label className="text-xs font-medium text-slate-700">Brand Name *</label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.sys_brand_name || ''}
          onChange={e => {
            setField('sys_brand_name', e.target.value);
            setField('sys_family_name', ''); // Reset family when brand changes
          }}
        >
          <option value="">Select brand…</option>
          {brands.map(b => (
            <option key={b.id} value={b.brand_name}>{b.brand_name}</option>
          ))}
        </select>
      </div>

      {/* Product Family */}
      <div>
        <label className="text-xs font-medium text-slate-700">Product Family *</label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.sys_family_name || ''}
          onChange={e => setField('sys_family_name', e.target.value)}
        >
          <option value="">Select family…</option>
          {filteredFamilies.map(f => (
            <option key={f.id} value={f.family_name}>{f.family_name}</option>
          ))}
        </select>
        {form.sys_brand_name && filteredFamilies.length === 0 && (
          <p className="text-xs text-amber-600 mt-0.5">No families found for this brand</p>
        )}
      </div>

      {/* Short Code */}
      <div>
        <label className="text-xs font-medium text-slate-700">Short Code</label>
        <Input
          className="h-9 text-sm mt-1 uppercase"
          maxLength={3}
          value={form.sys_short_code || ''}
          onChange={e => setField('sys_short_code', e.target.value.toUpperCase())}
          placeholder="e.g. MNG (2-3 letters)"
        />
        <p className="text-xs text-slate-500 mt-0.5">2-3 letter code used in Product Code generation</p>
      </div>
    </div>
  );
}

export function validateFlavourFields(form) {
  if (!form.sys_brand_name) return 'Brand Name is required for Flavour';
  if (!form.sys_family_name) return 'Product Family is required for Flavour';
  return null;
}