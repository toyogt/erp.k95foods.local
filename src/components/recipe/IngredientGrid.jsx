import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Lock, Unlock, AlertTriangle, ShieldBan } from 'lucide-react';

const PHASES = ['BREW', 'SYRUP', 'MIX', 'ADDITION', 'PACKING'];

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
    onChange(rows.map(r => r._key === key ? { ...r, [field]: value, ...(field === 'ingredient_id' ? { lock_brand: false, ingredient_item_id: '' } : {}) } : r));
  }

  function addRow() { onChange([...rows, emptyRow()]); }
  function removeRow(key) { onChange(rows.filter(r => r._key !== key)); }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="hidden lg:grid grid-cols-12 gap-1 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        <div className="col-span-3">Ingredient Spec</div>
        <div className="col-span-1">Qty</div>
        <div className="col-span-1">UOM</div>
        <div className="col-span-2">Phase</div>
        <div className="col-span-3">Brand Lock</div>
        <div className="col-span-1">Notes</div>
        <div className="col-span-1"></div>
      </div>

      {rows.map(row => {
        const spec = specs.find(s => s.ingredient_id === row.ingredient_id);
        const specBrands = brandItems.filter(bi => bi.ingredient_id === row.ingredient_id && bi.is_active);
        const lockedItem = brandItems.find(bi => bi.item_id === row.ingredient_item_id);
        const isBlocked = lockedItem?.status === 'BLOCKED';

        return (
          <div key={row._key} className={`lg:grid lg:grid-cols-12 gap-1 items-start flex flex-col bg-white border rounded-xl p-2 ${isBlocked ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
            {/* Ingredient SPEC */}
            <div className="col-span-3 w-full">
              <select
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 bg-white"
                value={row.ingredient_id}
                onChange={e => update(row._key, 'ingredient_id', e.target.value)}
              >
                <option value="">— Select Spec —</option>
                {specs.map(s => (
                  <option key={s.ingredient_id} value={s.ingredient_id}>
                    {s.short_code} · {isAdmin ? s.ingredient_name : `[${s.short_code}]`}
                  </option>
                ))}
              </select>
            </div>

            {/* Qty */}
            <div className="col-span-1 w-full">
              <input
                type="number"
                min="0"
                step="any"
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                placeholder="Qty"
                value={row.qty}
                onChange={e => update(row._key, 'qty', e.target.value)}
              />
            </div>

            {/* UOM */}
            <div className="col-span-1 w-full">
              <select
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 bg-white"
                value={row.uom_id}
                onChange={e => update(row._key, 'uom_id', e.target.value)}
              >
                <option value="">UOM</option>
                {uoms.map(u => <option key={u.uom_id} value={u.uom_id}>{u.uom_code}</option>)}
              </select>
            </div>

            {/* Phase */}
            <div className="col-span-2 w-full">
              <select
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 bg-white"
                value={row.phase}
                onChange={e => update(row._key, 'phase', e.target.value)}
              >
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Brand Lock */}
            <div className="col-span-3 w-full space-y-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => update(row._key, 'lock_brand', !row.lock_brand)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${row.lock_brand ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500'}`}
                  title={row.lock_brand ? 'Remove brand lock' : 'Lock to brand'}
                >
                  {row.lock_brand ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {row.lock_brand ? 'Locked' : 'Any'}
                </button>
                {row.lock_brand && (
                  <select
                    className={`flex-1 h-7 px-2 rounded-lg border text-xs focus:outline-none bg-white ${isBlocked ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'}`}
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
                  <ShieldBan className="w-3 h-3" /> BLOCKED brand — cannot save
                </p>
              )}
              {row.lock_brand && lockedItem && lockedItem.status !== 'BLOCKED' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLE[lockedItem.status] || ''}`}>
                  {lockedItem.status}
                </span>
              )}
            </div>

            {/* Notes */}
            <div className="col-span-1 w-full">
              <input
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                placeholder="Notes"
                value={row.notes}
                onChange={e => update(row._key, 'notes', e.target.value)}
              />
            </div>

            {/* Delete */}
            <div className="col-span-1 flex justify-end">
              <button onClick={() => removeRow(row._key)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5 w-full border-dashed">
        <Plus className="w-3.5 h-3.5" /> Add Row
      </Button>
    </div>
  );
}