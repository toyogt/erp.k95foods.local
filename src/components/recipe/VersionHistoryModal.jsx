import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, X } from 'lucide-react';

export default function VersionHistoryModal({ versions, specs, uoms, onClose }) {
  const [selectedVersionId, setSelectedVersionId] = useState(versions.find(v => v.is_active)?.version_id || versions[0]?.version_id);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedVersionId) loadIngredients(selectedVersionId);
  }, [selectedVersionId]);

  async function loadIngredients(vid) {
    setLoading(true);
    const rows = await base44.entities.RecipeVersionIngredient.filter({ version_id: vid });
    setIngredients(rows);
    setLoading(false);
  }

  const selectedVersion = versions.find(v => v.version_id === selectedVersionId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Version History</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: version list */}
          <div className="w-48 shrink-0 border-r border-slate-200 overflow-y-auto p-3 space-y-1">
            {versions.map(v => (
              <button
                key={v.version_id}
                onClick={() => setSelectedVersionId(v.version_id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                  selectedVersionId === v.version_id
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {v.is_active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  <span className="font-semibold">v{v.version_no}</span>
                  {v.is_active && <span className="text-xs opacity-70">(active)</span>}
                </div>
                {v.version_name && (
                  <p className={`text-xs mt-0.5 truncate ${selectedVersionId === v.version_id ? 'text-slate-300' : 'text-slate-400'}`}>{v.version_name}</p>
                )}
                <p className={`text-xs mt-0.5 ${selectedVersionId === v.version_id ? 'text-slate-400' : 'text-slate-400'}`}>
                  {v.created_at ? new Date(v.created_at).toLocaleDateString() : ''}
                </p>
              </button>
            ))}
          </div>

          {/* Right: version detail */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedVersion && (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-slate-800">Version {selectedVersion.version_no}{selectedVersion.version_name ? ` — ${selectedVersion.version_name}` : ''}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{selectedVersion.change_note}</p>
                  <p className="text-xs text-slate-400 mt-1">By {selectedVersion.created_by || '—'} · {selectedVersion.created_at ? new Date(selectedVersion.created_at).toLocaleString() : ''}</p>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : ingredients.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4">No ingredients in this version.</p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
                      <div className="col-span-5">Ingredient</div>
                      <div className="col-span-2">Qty</div>
                      <div className="col-span-2">UOM</div>
                      <div className="col-span-3">Brand</div>
                    </div>
                    {ingredients.map((ing, i) => {
                      const spec = specs.find(s => s.ingredient_id === ing.ingredient_id);
                      const uom = uoms.find(u => u.uom_id === ing.uom_id);
                      return (
                        <div key={i} className="grid grid-cols-12 gap-2 px-2 py-2 bg-slate-50 rounded-lg text-sm">
                          <div className="col-span-5">
                            <span className="font-mono text-xs text-slate-500">{spec?.short_code}</span>{' '}
                            <span className="text-slate-800">{spec?.ingredient_name || ing.ingredient_id}</span>
                          </div>
                          <div className="col-span-2 font-semibold text-slate-700">{ing.qty}</div>
                          <div className="col-span-2">
                            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{uom?.uom_code || '—'}</span>
                          </div>
                          <div className="col-span-3 text-xs text-slate-500">
                            {ing.lock_brand ? (ing.ingredient_item_id ? `🔒 ${ing.ingredient_item_id}` : 'Locked') : 'Any'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}