import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, X, ChevronLeft } from 'lucide-react';

export default function VersionHistoryModal({ versions, specs, uoms, brandItems, onClose }) {
  const [selectedVersionId, setSelectedVersionId] = useState(versions.find(v => v.is_active)?.version_id || versions[0]?.version_id);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false); // mobile: show detail view

  useEffect(() => {
    if (selectedVersionId) loadIngredients(selectedVersionId);
  }, [selectedVersionId]);

  async function loadIngredients(vid) {
    setLoading(true);
    const rows = await base44.entities.RecipeVersionIngredient.filter({ version_id: vid });
    setIngredients(rows);
    setLoading(false);
  }

  function selectVersion(vId) {
    setSelectedVersionId(vId);
    setShowDetail(true);
  }

  const selectedVersion = versions.find(v => v.version_id === selectedVersionId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 shrink-0">
          {showDetail ? (
            <button onClick={() => setShowDetail(false)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 sm:hidden">
              <ChevronLeft className="w-4 h-4" /> All Versions
            </button>
          ) : (
            <h2 className="text-lg font-bold text-slate-900">Version History</h2>
          )}
          {!showDetail && <h2 className="text-lg font-bold text-slate-900 hidden sm:block">Version History</h2>}
          {showDetail && <h2 className="text-base font-bold text-slate-900 hidden sm:block">Version History</h2>}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 ml-auto">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Version list - hidden on mobile when detail is open */}
          <div className={`${showDetail ? 'hidden sm:flex' : 'flex'} sm:flex w-full sm:w-44 shrink-0 flex-col border-r border-slate-200 overflow-y-auto`}>
            <div className="p-3 space-y-1">
              {versions.map(v => (
                <button
                  key={v.version_id}
                  onClick={() => selectVersion(v.version_id)}
                  className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all ${
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
          </div>

          {/* Detail panel - full width on mobile when open */}
          <div className={`${!showDetail ? 'hidden sm:block' : 'block'} flex-1 overflow-y-auto p-4`}>
            {selectedVersion && (
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-slate-800 text-base">
                    Version {selectedVersion.version_no}
                    {selectedVersion.version_name ? ` — ${selectedVersion.version_name}` : ''}
                    {selectedVersion.is_active && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{selectedVersion.change_note}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    By {selectedVersion.created_by || '—'} · {selectedVersion.created_at ? new Date(selectedVersion.created_at).toLocaleString() : ''}
                  </p>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : ingredients.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4">No ingredients in this version.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{ingredients.length} Ingredient{ingredients.length !== 1 ? 's' : ''}</p>
                    {ingredients.map((ing, i) => {
                      const spec = specs.find(s => s.ingredient_id === ing.ingredient_id);
                      const uom = uoms.find(u => u.uom_id === ing.uom_id);
                      const brandItem = brandItems?.find(bi => bi.item_id === ing.ingredient_item_id);
                      return (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs text-slate-400">{spec?.short_code} </span>
                              <span className="text-sm font-semibold text-slate-800">{spec?.ingredient_name || ing.ingredient_id}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-bold text-slate-700">{ing.qty}</span>
                              <span className="text-xs text-blue-600 ml-1.5 font-mono bg-blue-50 px-1.5 py-0.5 rounded">{uom?.uom_code || '—'}</span>
                            </div>
                          </div>
                          {ing.lock_brand && (
                            <p className="text-xs text-orange-600 font-semibold">
                              🔒 {brandItem ? brandItem.brand_name : (ing.ingredient_item_id || 'Locked')}
                            </p>
                          )}
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