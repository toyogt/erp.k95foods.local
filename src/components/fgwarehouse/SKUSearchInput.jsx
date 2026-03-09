import { useState } from 'react';
import { Search, X } from 'lucide-react';

export default function SKUSearchInput({ skus, value, onChange, placeholder = 'Search by name, brand or code…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedSku = skus.find(s => s.item_code === value);

  const filtered = skus
    .filter(s => s.is_active !== false)
    .filter(s => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        s.item_code?.toLowerCase().includes(q) ||
        s.product_name?.toLowerCase().includes(q) ||
        s.brand_name?.toLowerCase().includes(q) ||
        s.flavour?.toLowerCase().includes(q) ||
        s.product_family?.toLowerCase().includes(q)
      );
    })
    .slice(0, 30);

  const select = (sku) => {
    onChange(sku.item_code);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      {selectedSku ? (
        <div className="flex items-center border border-slate-300 rounded-xl px-3 py-3 bg-white min-h-[56px]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-snug">
              {selectedSku.brand_name ? `${selectedSku.brand_name} — ` : ''}{selectedSku.product_name}
              {selectedSku.flavour ? ` (${selectedSku.flavour})` : ''}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedSku.item_code} · {selectedSku.bottles_per_box} btls/box
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="ml-2 p-2 rounded-lg hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-3.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 min-h-[52px]"
          />
        </div>
      )}

      {open && !selectedSku && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-3 text-center">No matching SKUs</p>
          ) : (
            filtered.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-0"
              >
                <p className="text-sm font-semibold text-slate-900 leading-snug">
                  {s.brand_name ? `${s.brand_name} — ` : ''}{s.product_name}
                  {s.flavour ? ` (${s.flavour})` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.item_code}{s.product_family ? ` · ${s.product_family}` : ''} · {s.bottles_per_box} btls/box
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}