import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, ShieldBan, Lock } from 'lucide-react';

/**
 * SaveVersionModal
 * Step 1: Review ingredients (always shown)
 * Step 2: Enter change note + version name (only for v2+)
 * For v1 (isFirstVersion), skips step 2 and saves directly after review.
 */
export default function SaveVersionModal({ currentVersionNo, rows, specs, uoms, brandItems, onSave, onCancel }) {
  const isFirstVersion = !currentVersionNo || currentVersionNo === 0;
  const nextVersionNo = (currentVersionNo || 0) + 1;

  const [step, setStep] = useState('review'); // 'review' | 'note'
  const [changeNote, setChangeNote] = useState('');
  const [versionName, setVersionName] = useState('');
  const [saving, setSaving] = useState(false);

  const validRows = rows.filter(r => r.ingredient_id);
  const hasZeroQty = validRows.some(r => !r.qty || parseFloat(r.qty) <= 0);

  async function handleConfirmReview() {
    if (isFirstVersion) {
      // Save immediately — no change note needed for first version
      setSaving(true);
      await onSave({ changeNote: 'Initial version', versionName: '' });
      setSaving(false);
    } else {
      setStep('note');
    }
  }

  async function handleSaveNote() {
    if (!changeNote.trim()) return;
    setSaving(true);
    await onSave({ changeNote: changeNote.trim(), versionName: versionName.trim() });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">
              {step === 'review' ? 'Review Recipe Before Saving' : `Save as Version ${nextVersionNo}`}
            </h2>
            {step === 'review' && (
              <p className="text-xs text-slate-400 mt-0.5">Please verify all ingredients, quantities and UOMs are correct.</p>
            )}
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none ml-3">×</button>
        </div>

        {/* Step 1: Review */}
        {step === 'review' && (
          <>
            <div className="overflow-y-auto flex-1 p-5 space-y-2">
              {validRows.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">No ingredients added yet.</p>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-2 px-3 pb-1">
                    <span className="col-span-5 text-xs font-bold text-slate-400 uppercase tracking-wide">Ingredient</span>
                    <span className="col-span-3 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Qty</span>
                    <span className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">UOM</span>
                    <span className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Brand</span>
                  </div>

                  {validRows.map((row, idx) => {
                    const spec = specs.find(s => s.ingredient_id === row.ingredient_id);
                    const uom = uoms.find(u => u.uom_id === row.uom_id);
                    const lockedItem = brandItems?.find(bi => bi.item_id === row.ingredient_item_id);
                    const isBlocked = lockedItem?.status === 'BLOCKED';
                    const isHold = lockedItem?.status === 'HOLD';
                    const hasNoApprovedBrands = !row.lock_brand && brandItems?.filter(bi => bi.ingredient_id === row.ingredient_id && bi.is_active && bi.status === 'APPROVED').length === 0;

                    return (
                      <div
                        key={row._key || idx}
                        className={`rounded-xl border p-3 grid grid-cols-12 gap-2 items-start ${
                          isBlocked ? 'border-red-300 bg-red-50' : isHold ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        {/* Ingredient name */}
                        <div className="col-span-5">
                          <p className="text-xs font-mono text-slate-400">{spec?.short_code}</p>
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{spec?.ingredient_name || row.ingredient_id}</p>
                        </div>

                        {/* Qty */}
                        <div className="col-span-3 text-right">
                          <p className={`text-base font-bold ${(!row.qty || row.qty == 0) ? 'text-red-500' : 'text-slate-800'}`}>
                            {row.qty || <span className="text-red-400 text-sm">⚠ 0</span>}
                          </p>
                        </div>

                        {/* UOM */}
                        <div className="col-span-2 flex justify-center">
                          {uom ? (
                            <span className="text-xs font-bold font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {uom.uom_code}
                            </span>
                          ) : (
                            <span className="text-xs text-red-400 font-semibold">—</span>
                          )}
                        </div>

                        {/* Brand */}
                        <div className="col-span-2 flex justify-center">
                          {row.lock_brand ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Lock className={`w-3.5 h-3.5 ${isBlocked ? 'text-red-500' : isHold ? 'text-amber-500' : 'text-orange-500'}`} />
                              <span className={`text-xs font-semibold text-center leading-tight ${isBlocked ? 'text-red-600' : isHold ? 'text-amber-600' : 'text-orange-600'}`}>
                                {lockedItem ? lockedItem.brand_name : '?'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold text-center">Any</span>
                          )}
                        </div>

                        {/* Warnings below the row */}
                        {(isBlocked || isHold || hasNoApprovedBrands || !row.qty || row.qty == 0) && (
                          <div className="col-span-12 space-y-1 mt-1">
                            {isBlocked && (
                              <p className="text-xs text-red-700 font-semibold flex items-center gap-1">
                                <ShieldBan className="w-3 h-3 shrink-0" /> Locked brand is BLOCKED — fix before release.
                              </p>
                            )}
                            {isHold && (
                              <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Locked brand is on HOLD.
                              </p>
                            )}
                            {hasNoApprovedBrands && (
                              <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> No approved brands available for this ingredient.
                              </p>
                            )}
                            {(!row.qty || row.qty == 0) && (
                              <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Quantity is 0 — please verify.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* QA check notice */}
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      <strong>Please double-check:</strong> Confirm each ingredient's quantity matches the correct UOM unit
                      (e.g. ensure you're entering <em>kg</em> not <em>g</em>). Once saved, this becomes the active recipe version.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
              <Button variant="ghost" onClick={onCancel} className="h-12 flex-1">Cancel</Button>
              <Button
                className="h-12 flex-1"
                disabled={validRows.length === 0 || hasZeroQty || saving}
                onClick={handleConfirmReview}
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isFirstVersion
                  ? 'Confirm & Save'
                  : 'Looks Good → Next'}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Change note (v2+) */}
        {step === 'note' && (
          <>
            <div className="p-5 space-y-4 flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                This will create <strong>Version {nextVersionNo}</strong>. The previous version will be archived.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Change Note <span className="text-red-500">*</span></label>
                <textarea
                  autoFocus
                  className="w-full h-24 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Why are you changing this recipe? (required)"
                  value={changeNote}
                  onChange={e => setChangeNote(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Version Name <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Summer 2026 Formula"
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
              <Button variant="ghost" className="h-12" onClick={() => setStep('review')}>← Back</Button>
              <Button
                className="h-12 flex-1"
                disabled={!changeNote.trim() || saving}
                onClick={handleSaveNote}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Version'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}