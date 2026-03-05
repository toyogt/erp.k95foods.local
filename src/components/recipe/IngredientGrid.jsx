import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Lock, Unlock, ShieldBan, Search } from 'lucide-react';

const STATUS_STYLE = {
  APPROVED: 'bg-emerald-100 text-emerald-700',
  HOLD: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

function emptyRow() {
  return { _key: Date.now() + Math.random(), ingredient_id: '', qty: '', uom_id: '', phase: 'MIX', notes: '', lock_brand: false, ingredient_item_id: '' };
}

function IngredientSearch({ value, specs, usedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);
  const selected = specs.find(s => s.ingredient_id === value);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = specs.filter(s => {
    if (usedIds.includes(s.ingredient_id) && s.ingredient_id !== value) return false;
    if (!query) return true;
    return (
      s.ingredient_name?.toLowerCase().includes(query.toLowerCase()) ||
      s.short_code?.toLowerCase().includes(query.toLowerCase())
    );
  });

  function select(id) { onChange(id); setOpen(false); setQuery(''); }

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full h-12 px-3 rounded-lg border border-slate-200 text-sm text-left flex items-center justify-between bg-white hover:border-blue-400 focus:outline-none focus:border-blue-500 transition-colors"
      >
        <span className={selected ? 'text-slate-800 font-medium' : 'text-slate-400'}>
          {selected ? `${selected.short_code} · ${selected.ingredient_name}` : '— Select Ingredient —'}
        </span>
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Search by name or code…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-3 text-center">No results</p>
            )}
            {filtered.map(s => {
              const alreadyUsed = usedIds.includes(s.ingredient_id) && s.ingredient_id !== value;
              return (
                <button
                  key={s.ingredient_id}
                  type="button"
                  disabled={alreadyUsed}
                  onClick={() => select(s.ingredient_id)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                    s.ingredient_id === value
                      ? 'bg-slate-900 text-white'
                      : alreadyUsed
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-mono text-xs text-slate-400 w-10 shrink-0">{s.short_code}</span>
                  <span className="truncate">{s.ingredient_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IngredientGrid({ rows, onChange, specs, uoms, brandItems, isAdmin }) {
  function update(key, field, value) {
    onChange(rows.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: value };
      if (field === 'ingredient_id') {
        const spec = specs.find(s => s.ingredient_id === value);
        updated.uom_id = spec?.uom_id || '';
        updated.lock_brand = false;
        updated.ingredient_item_id = '';
      }
      return updated;
    }));
  }

  function addRow() { onChange([...rows, emptyRow()]); }
  function removeRow(key) { onChange(rows.filter(r => r._key !== key)); }

  const usedIngredientIds = rows.filter(r => r.ingredient_id).map(r => r.ingredient_id);

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const spec = specs.find(s => s.ingredient_id === row.ingredient_id);
        // Only show APPROVED brand items
        const specBrands = brandItems.filter(bi => bi.ingredient_id === row.ingredient_id && bi.is_active && bi.status === 'APPROVED');
        const lockedItem = brandItems.find(bi => bi.item_id === row.ingredient_item_id);
        const isBlocked = lockedItem?.status === 'BLOCKED';
        const uom = uoms.find(u => u.uom_id === row.uom_id);
        const usedByOthers = rows.filter(r => r._key !== row._key).map(r => r.ingredient_id).filter(Boolean);

        return (
          <div
            key={row._key}
            className={`rounded-xl border p-4 space-y-3 ${isBlocked ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50/50'}`}
          >
            {/* Row number + delete */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ingredient #{idx + 1}</span>
              <button
                onClick={() => removeRow(row._key)}
                className="h-9 w-9 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Ingredient selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ingredient</label>
              <IngredientSearch
                value={row.ingredient_id}
                specs={specs}
                usedIds={usedByOthers}
                onChange={val => update(row._key, 'ingredient_id', val)}
              />
            </div>

            {/* Qty + UOM */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className="w-full h-12 px-3 rounded-lg border border-slate-200 text-base focus:outline-none focus:border-blue-500 bg-white"
                  placeholder="0"
                  value={row.qty}
                  onChange={e => update(row._key, 'qty', e.target.value)}
                />
              </div>
              <div className="shrink-0">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">UOM</label>
                <span className="h-12 flex items-center px-4 rounded-lg bg-blue-50 border border-blue-200 text-sm font-bold text-blue-700 font-mono min-w-[64px] justify-center">
                  {uom ? uom.uom_code : <span className="text-slate-300 font-normal text-xs">—</span>}
                </span>
              </div>
            </div>

            {/* Brand Lock */}
            {row.ingredient_id && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Brand Lock</label>
                <div className="space-y-2">
                  <button
                    onClick={() => update(row._key, 'lock_brand', !row.lock_brand)}
                    className={`flex items-center gap-2 h-11 px-4 rounded-lg text-sm font-semibold transition-colors border ${
                      row.lock_brand
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {row.lock_brand ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {row.lock_brand ? 'Locked to Brand' : 'Any Brand'}
                  </button>
                  {row.lock_brand && (
                    <select
                      className={`w-full h-12 px-3 rounded-lg border text-sm focus:outline-none bg-white ${
                        isBlocked ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'
                      }`}
                      value={row.ingredient_item_id}
                      onChange={e => update(row._key, 'ingredient_item_id', e.target.value)}
                    >
                      <option value="">— Pick brand —</option>
                      {specBrands.map(bi => (
                        <option key={bi.item_id} value={bi.item_id}>
                          {bi.brand_name}{bi.supplier_name ? ` (${bi.supplier_name})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {isBlocked && (
                    <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                      <ShieldBan className="w-3 h-3" /> BLOCKED — cannot save
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addRow}
        className="w-full h-12 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add Ingredient
      </button>
    </div>
  );
}