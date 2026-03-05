import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Lock, Unlock, ShieldBan, AlertTriangle, Search, Eye } from 'lucide-react';

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
            <input ref={inputRef} autoFocus className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500" placeholder="Search by name or code…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-slate-400 px-3 py-3 text-center">No results</p>}
            {filtered.map(s => {
              const alreadyUsed = usedIds.includes(s.ingredient_id) && s.ingredient_id !== value;
              return (
                <button key={s.ingredient_id} type="button" disabled={alreadyUsed} onClick={() => select(s.ingredient_id)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${s.ingredient_id === value ? 'bg-slate-900 text-white' : alreadyUsed ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 text-slate-700'}`}>
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

const STATUS_BADGE = {
  APPROVED: 'bg-emerald-100 text-emerald-700',
  HOLD: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

export default function IngredientGrid({ rows, onChange, specs, uoms, brandItems, isAdmin }) {
  // Per-row toggle: show non-approved brands (admin only)
  const [showNonApproved, setShowNonApproved] = useState({});

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
        const uom = uoms.find(u => u.uom_id === row.uom_id);
        const usedByOthers = rows.filter(r => r._key !== row._key).map(r => r.ingredient_id).filter(Boolean);
        const showAll = showNonApproved[row._key] && isAdmin;

        // All brand items for this spec
        const allSpecBrands = brandItems.filter(bi => bi.ingredient_id === row.ingredient_id && bi.is_active);
        // Approved only
        const approvedBrands = allSpecBrands.filter(bi => bi.status === 'APPROVED');
        // Brands shown in dropdown
        const dropdownBrands = showAll ? allSpecBrands : approvedBrands;

        // Current locked item (may be non-approved if changed after locking)
        const lockedItem = brandItems.find(bi => bi.item_id === row.ingredient_item_id);
        const lockedStatus = lockedItem?.status;
        const isBlocked = lockedStatus === 'BLOCKED';
        const isHold = lockedStatus === 'HOLD';
        const hasNoApprovedBrands = row.ingredient_id && approvedBrands.length === 0;

        // If locked item is not in dropdown, add it so it's still visible
        const lockedItemInDropdown = !row.ingredient_item_id || dropdownBrands.some(bi => bi.item_id === row.ingredient_item_id);

        return (
          <div key={row._key} className={`rounded-xl border p-4 space-y-3 ${isBlocked ? 'border-red-300 bg-red-50' : isHold ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
            {/* Row number + delete */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ingredient #{idx + 1}</span>
              <button onClick={() => removeRow(row._key)} className="h-9 w-9 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Ingredient selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ingredient</label>
              <IngredientSearch value={row.ingredient_id} specs={specs} usedIds={usedByOthers} onChange={val => update(row._key, 'ingredient_id', val)} />
            </div>

            {/* No approved brands warning */}
            {hasNoApprovedBrands && (
              <p className="text-xs text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> No approved brands available for {spec?.short_code || 'this ingredient'}.
              </p>
            )}

            {/* Qty + UOM */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Quantity</label>
                <input type="number" min="0" step="any" inputMode="decimal"
                  className="w-full h-12 px-3 rounded-lg border border-slate-200 text-base focus:outline-none focus:border-blue-500 bg-white"
                  placeholder="0" value={row.qty} onChange={e => update(row._key, 'qty', e.target.value)} />
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
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Brand</label>
                <div className="space-y-2">
                  <button
                    onClick={() => update(row._key, 'lock_brand', !row.lock_brand)}
                    className={`flex items-center gap-2 h-11 px-4 rounded-lg text-sm font-semibold transition-colors border ${row.lock_brand ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {row.lock_brand ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {row.lock_brand ? 'Locked to Brand' : 'Any APPROVED Brand'}
                  </button>

                  {row.lock_brand && (
                    <>
                      <select
                        className={`w-full h-12 px-3 rounded-lg border text-sm focus:outline-none bg-white ${isBlocked ? 'border-red-400' : isHold ? 'border-amber-400' : 'border-slate-200 focus:border-blue-500'}`}
                        value={row.ingredient_item_id}
                        onChange={e => update(row._key, 'ingredient_item_id', e.target.value)}
                      >
                        <option value="">— Pick brand —</option>
                        {/* Always show current locked item even if not in filtered list */}
                        {!lockedItemInDropdown && lockedItem && (
                          <option value={lockedItem.item_id}>
                            ⚠ {lockedItem.brand_name} [{lockedStatus}]
                          </option>
                        )}
                        {dropdownBrands.map(bi => (
                          <option key={bi.item_id} value={bi.item_id}>
                            {bi.brand_name}{bi.supplier_name ? ` (${bi.supplier_name})` : ''}{showAll && bi.status !== 'APPROVED' ? ` [${bi.status}]` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Admin toggle: show non-approved */}
                      {isAdmin && (
                        <button
                          onClick={() => setShowNonApproved(s => ({ ...s, [row._key]: !s[row._key] }))}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${showAll ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {showAll ? 'Showing all brands (admin)' : 'Show non-approved brands'}
                        </button>
                      )}

                      {/* Status warnings */}
                      {isBlocked && (
                        <p className="text-xs text-red-700 font-semibold flex items-center gap-1 bg-red-100 border border-red-300 rounded-lg px-3 py-2">
                          <ShieldBan className="w-3.5 h-3.5 shrink-0" /> Locked brand is <strong>BLOCKED</strong> — recipe will be blocked for production until replaced.
                        </p>
                      )}
                      {isHold && (
                        <p className="text-xs text-amber-700 font-semibold flex items-center gap-1 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Locked brand is on <strong>HOLD</strong> — under review, cannot be released for production.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addRow} className="w-full h-12 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Add Ingredient
      </button>
    </div>
  );
}