import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Search, Pencil, Trash2, AlertTriangle, ShieldBan, CheckCircle2, Clock } from 'lucide-react';
import ReplaceWizard from './ReplaceWizard';

function genItemId() { return 'ITM-' + Date.now().toString(36).toUpperCase().slice(-6); }

const STATUS_CONFIG = {
  APPROVED: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  HOLD: { label: 'Hold', color: 'bg-amber-100 text-amber-700', icon: Clock },
  BLOCKED: { label: 'Blocked', color: 'bg-red-100 text-red-700', icon: ShieldBan },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.APPROVED;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function ItemForm({ initial, ingredientId, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    item_id: initial?.item_id || genItemId(),
    ingredient_id: ingredientId,
    brand_name: initial?.brand_name || '',
    supplier_name: initial?.supplier_name || '',
    status: initial?.status || 'APPROVED',
    is_active: initial?.is_active !== false,
    notes: initial?.notes || '',
  }));

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Brand Name *</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Univar, Jungbunzlauer" value={form.brand_name} onChange={e => setForm(v => ({ ...v, brand_name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Supplier Name</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" placeholder="Optional" value={form.supplier_name} onChange={e => setForm(v => ({ ...v, supplier_name: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
          <select className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 bg-white" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}>
            <option value="APPROVED">Approved</option>
            <option value="HOLD">Hold (under review)</option>
            <option value="BLOCKED">Blocked (do not use)</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm text-slate-700">Active</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea className="w-full h-12 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.brand_name.trim()}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Brand Item'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function IngredientBrandTab({ user }) {
  const [specs, setSpecs] = useState([]);
  const [brandItems, setBrandItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecId, setSelectedSpecId] = useState('');
  const [specSearch, setSpecSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [wizard, setWizard] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [sp, bi] = await Promise.all([
      base44.entities.IngredientMaster.list('ingredient_name', 500),
      base44.entities.IngredientItem.list('-created_date', 1000),
    ]);
    setSpecs(sp);
    setBrandItems(bi);
    setLoading(false);
  }

  const selectedSpec = specs.find(s => s.ingredient_id === selectedSpecId);
  const specBrands = brandItems.filter(bi => bi.ingredient_id === selectedSpecId);
  const blockedItems = specBrands.filter(bi => bi.status === 'BLOCKED');

  const filteredSpecs = specs.filter(s => {
    if (!specSearch) return true;
    const q = specSearch.toLowerCase();
    return s.ingredient_name?.toLowerCase().includes(q) || s.short_code?.toLowerCase().includes(q);
  });

  async function saveItem(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.IngredientItem.create(form);
    } else {
      const rec = brandItems.find(i => i.id === editing);
      if (rec) {
        const oldStatus = rec.status;
        await base44.entities.IngredientItem.update(rec.id, form);
        // Audit log if status changed
        if (oldStatus !== form.status) {
          await base44.entities.AuditLog.create({
            action: 'BRAND_ITEM_STATUS_CHANGED',
            entity_type: 'IngredientItem',
            entity_id: rec.item_id,
            user_email: user?.email || '',
            user_name: user?.full_name || '',
            details: { brand_name: rec.brand_name, ingredient_id: rec.ingredient_id, old_status: oldStatus, new_status: form.status },
          });
        }
      }
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function blockItem(item) {
    if (!confirm(`Block brand "${item.brand_name}"? It will be marked as DO NOT USE.`)) return;
    await base44.entities.IngredientItem.update(item.id, { status: 'BLOCKED' });
    await base44.entities.AuditLog.create({
      action: 'BRAND_ITEM_BLOCKED',
      entity_type: 'IngredientItem',
      entity_id: item.item_id,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: { brand_name: item.brand_name, ingredient_id: item.ingredient_id },
    });
    await load();
  }

  async function del(item) {
    if (!confirm(`Delete brand item "${item.brand_name}"?`)) return;
    await base44.entities.IngredientItem.delete(item.id);
    await load();
  }

  async function doReplaceItem(oldItem, newItemId) {
    const newItem = brandItems.find(bi => bi.item_id === newItemId);
    // Future: update recipe lines locked to item_id here
    await base44.entities.IngredientItem.update(brandItems.find(bi => bi.item_id === oldItem.item_id)?.id, { is_active: false });
    await base44.entities.AuditLog.create({
      action: 'BRAND_ITEM_REPLACE',
      entity_type: 'IngredientItem',
      entity_id: oldItem.item_id,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: { old_item_id: oldItem.item_id, new_item_id: newItemId },
    });
    await load();
    return `Brand item "${oldItem.brand_name}" deactivated. Replaced with "${newItem?.brand_name}".`;
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Spec selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Select Ingredient Spec</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 h-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Search by name or short code…"
            value={specSearch}
            onChange={e => setSpecSearch(e.target.value)}
          />
        </div>
        <div className="max-h-44 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
          {filteredSpecs.map(s => {
            const sbi = brandItems.filter(bi => bi.ingredient_id === s.ingredient_id);
            const hasBlocked = sbi.some(bi => bi.status === 'BLOCKED');
            return (
              <button
                key={s.ingredient_id}
                onClick={() => { setSelectedSpecId(s.ingredient_id); setEditing(null); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${selectedSpecId === s.ingredient_id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <span className="font-mono text-xs bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">{s.short_code}</span>
                <span className="flex-1 truncate">{s.ingredient_name}</span>
                {hasBlocked && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="text-xs text-slate-400 shrink-0">{sbi.length} brand{sbi.length !== 1 ? 's' : ''}</span>
              </button>
            );
          })}
          {filteredSpecs.length === 0 && <p className="text-xs text-slate-400 p-3">No specs found.</p>}
        </div>
      </div>

      {/* Brand items for selected spec */}
      {selectedSpec && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="font-mono bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-base">{selectedSpec.short_code}</span>
                {selectedSpec.ingredient_name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{specBrands.length} brand item(s) registered</p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}>
              <Plus className="w-4 h-4" /> Add Brand
            </Button>
          </div>

          {blockedItems.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">⚠ Blocked brand(s) exist</p>
                <p className="text-xs text-red-600 mt-0.5">{blockedItems.map(b => b.brand_name).join(', ')} — DO NOT USE</p>
              </div>
            </div>
          )}

          {editing === 'new' && (
            <ItemForm initial={null} ingredientId={selectedSpecId} onSave={saveItem} onCancel={() => setEditing(null)} saving={saving} />
          )}

          <div className="space-y-2">
            {specBrands.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No brand items yet. Add one above.</p>}
            {specBrands.map(item => (
              <div key={item.id} className={`bg-white rounded-xl border p-3 ${item.status === 'BLOCKED' ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                {editing === item.id ? (
                  <ItemForm initial={item} ingredientId={selectedSpecId} onSave={saveItem} onCancel={() => setEditing(null)} saving={saving} />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-slate-800">{item.brand_name}</p>
                        <StatusBadge status={item.status} />
                        {!item.is_active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>}
                      </div>
                      {item.supplier_name && <p className="text-xs text-slate-500">Supplier: {item.supplier_name}</p>}
                      {item.notes && <p className="text-xs text-slate-400 italic">{item.notes}</p>}
                      <p className="text-xs text-slate-300 font-mono">{item.item_id}</p>
                    </div>
                    <div className="flex gap-1 items-center shrink-0">
                      {isAdmin && item.status !== 'BLOCKED' && (
                        <button onClick={() => blockItem(item)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200" title="Block brand">
                          <ShieldBan className="w-3.5 h-3.5" /> Block
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setWizard(item)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200" title="Replace with…">
                          Replace
                        </button>
                      )}
                      <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                      {isAdmin && (
                        <button onClick={() => del(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedSpec && (
        <div className="text-center py-10 text-slate-400 text-sm">Select an ingredient spec above to manage its brand items.</div>
      )}

      {wizard && (
        <ReplaceWizard
          title={`Replace Brand Item: ${wizard.brand_name}`}
          oldItem={{ label: wizard.brand_name, id: wizard.item_id }}
          options={specBrands
            .filter(bi => bi.item_id !== wizard.item_id && bi.is_active)
            .map(bi => ({ value: bi.item_id, label: `${bi.brand_name}${bi.supplier_name ? ' — ' + bi.supplier_name : ''}` }))}
          previewLines={() => [
            `Old item "${wizard.brand_name}" will be deactivated`,
            `Future recipe lines locked to this item will be updated`,
          ]}
          onConfirm={(newId) => doReplaceItem(wizard, newId)}
          onClose={() => { setWizard(null); load(); }}
        />
      )}
    </div>
  );
}