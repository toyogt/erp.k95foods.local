import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Lock, Unlock, ShieldBan } from 'lucide-react';

const STATUS_STYLE = {
  APPROVED: 'bg-emerald-100 text-emerald-700',
  HOLD: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

function emptyRow() {
  return { _key: Date.now() + Math.random(), ingredient_id: '', qty: '', uom_id: '', phase: 'MIX', notes: '', lock_brand: false, ingredient_item_id: '' };
}

export default function IngredientGrid({ rows, onChange, specs, uoms, brandItems, isAdmin }) {
  function update(key, field, value) {
    onChange(rows.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: value };
      // Auto-fill UOM from spec when ingredient changes, clear brand lock
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

  return (
    <div className="space-y-2">
      {/* Header — hidden on mobile, shown on desktop */}
      <div className="hidden lg:grid grid-cols-12 gap-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
        <div className="col-span-4">Ingredient Spec</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-1">UOM</div>
        <div className="col-span-4">Brand Lock</div>
        <div className="col-span-1"></div>
      </div>

      {rows.map(row => {
        const spec = specs.find(s => s.ingredient_id === row.ingredient_id);
        const specBrands = brandItems.filter(bi => bi.ingredient_id === row.ingredient_id && bi.is_active);
        const lockedItem = brandItems.find(bi => bi.item_id === row.ingredient_item_id);
        const isBlocked = lockedItem?.status === 'BLOCKED';
        const uom = uoms.find(u => u.uom_id === row.uom_id);

        return (
          <div
            key={row._key}
            className={`rounded-xl border p-3 space-y-2 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-2 lg:items-center ${isBlocked ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
          >
            {/* Ingredient SPEC */}
            <div className="col-span-4">
              <label className="block text-xs text-slate-400 mb-1 lg:hidden">Ingredient</label>
              <select
                className="w-full h-10 px-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                value={row.ingredient_id}
                onChange={e => update(row._key, 'ingredient_id', e.target.value)}
              >
                <option value="">— Select Ingredient —</option>
                {specs.map(s => (
                  <option key={s.ingredient_id} value={s.ingredient_id}>
                    {s.short_code} · {s.ingredient_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Qty + UOM side by side on mobile */}
            <div className="col-span-2 flex gap-2 lg:block">
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1 lg:hidden">Qty</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Qty"
                  value={row.qty}
                  onChange={e => update(row._key, 'qty', e.target.value)}
                />
              </div>
              {/* UOM chip — mobile shows inline */}
              <div className="flex-none lg:hidden flex items-end pb-0">
                <span className="h-10 flex items-center px-3 rounded-lg bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-700 font-mono whitespace-nowrap min-w-[48px] justify-center">
                  {uom ? uom.uom_code : <span className="text-slate-300">—</span>}
                </span>
              </div>
            </div>

            {/* UOM chip — desktop only */}
            <div className="col-span-1 hidden lg:flex items-center">
              <span className="h-10 w-full flex items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-700 font-mono">
                {uom ? uom.uom_code : <span className="text-slate-300 text-xs">—</span>}
              </span>
            </div>

            {/* Brand Lock */}
            <div className="col-span-4">
              <label className="block text-xs text-slate-400 mb-1 lg:hidden">Brand Lock</label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => update(row._key, 'lock_brand', !row.lock_brand)}
                    className={`flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold transition-colors border ${
                      row.lock_brand
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={row.lock_brand ? 'Remove brand lock' : 'Lock to brand'}
                  >
                    {row.lock_brand ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {row.lock_brand ? 'Locked' : 'Any'}
                  </button>
                  {row.lock_brand && (
                    <select
                      className={`flex-1 h-10 px-2 rounded-lg border text-sm focus:outline-none bg-white ${
                        isBlocked ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'
                      }`}
                      value={row.ingredient_item_id}
                      onChange={e => update(row._key, 'ingredient_item_id', e.target.value)}
                    >
                      <option value="">— Pick brand —</option>
                      {specBrands.map(bi => (
                        <option key={bi.item_id} value={bi.item_id}>
                          {bi.brand_name}{bi.supplier_name ? ` (${bi.supplier_name})` : ''} [{bi.status}]
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {isBlocked && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <ShieldBan className="w-3 h-3" /> BLOCKED — cannot save
                  </p>
                )}
                {row.lock_brand && lockedItem && lockedItem.status !== 'BLOCKED' && (
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[lockedItem.status] || ''}`}>
                    {lockedItem.status}
                  </span>
                )}
              </div>
            </div>

            {/* Delete */}
            <div className="col-span-1 flex justify-end lg:justify-center">
              <button
                onClick={() => removeRow(row._key)}
                className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      <Button size="default" variant="outline" onClick={addRow} className="gap-2 w-full border-dashed h-10 mt-2">
        <Plus className="w-4 h-4" /> Add Row
      </Button>
    </div>
  );
}