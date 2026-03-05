import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ShieldBan, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Utility: check active recipe version for a given recipe_id (plan.recipe_id maps to option_id or recipe_group_id).
 * Returns { ok, issues: [{ brand_name, ingredient_name, status }] }
 */
export async function checkRecipeBrandApproval(recipeId, brandItems, specs) {
  // recipeId on LiquidBatchPlan maps to RecipeOption.option_id
  const versions = await base44.entities.RecipeVersion.filter({ option_id: recipeId });
  const activeVersion = versions.find(v => v.is_active);
  if (!activeVersion) return { ok: true, issues: [] };

  const ingredients = await base44.entities.RecipeVersionIngredient.filter({ version_id: activeVersion.version_id });
  const issues = [];
  for (const ing of ingredients) {
    if (!ing.lock_brand || !ing.ingredient_item_id) continue;
    const item = brandItems.find(bi => bi.item_id === ing.ingredient_item_id);
    if (!item || item.status !== 'APPROVED' || !item.is_active) {
      const spec = specs.find(s => s.ingredient_id === ing.ingredient_id);
      issues.push({
        brand_name: item?.brand_name || ing.ingredient_item_id,
        ingredient_name: spec?.ingredient_name || ing.ingredient_id,
        status: item?.status || 'UNKNOWN',
      });
    }
  }
  return { ok: issues.length === 0, issues, version_id: activeVersion.version_id, option_id: recipeId };
}

/**
 * Modal: shown when releasing a plan that has brand approval issues.
 * Non-admins: blocked.
 * Admins: can override with a reason.
 */
export default function RecipeBrandReleaseCheck({ issues, isAdmin, planId, recipeId, versionId, user, onOverrideRelease, onCancel }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleOverride() {
    if (!reason.trim()) return;
    setSaving(true);
    await base44.entities.AuditLog.create({
      action: 'PLAN_RELEASE_BRAND_OVERRIDE',
      entity_type: 'LiquidBatchPlan',
      entity_id: planId,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: {
        plan_id: planId,
        recipe_option_id: recipeId,
        version_id: versionId,
        override_reason: reason.trim(),
        blocked_brands: issues.map(i => `${i.ingredient_name}: ${i.brand_name} [${i.status}]`),
      },
    });
    setSaving(false);
    onOverrideRelease(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShieldBan className="w-5 h-5 text-red-600" />
          <h2 className="font-bold text-slate-800">Brand Approval Issue</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-red-700 font-semibold">
            Cannot release: recipe locks non-approved brand(s):
          </p>
          <ul className="space-y-1.5">
            {issues.map((issue, i) => (
              <li key={i} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${issue.status === 'BLOCKED' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                {issue.status === 'BLOCKED' ? <ShieldBan className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                <span><strong>{issue.ingredient_name}</strong>: {issue.brand_name} — <span className="font-bold uppercase">{issue.status}</span></span>
              </li>
            ))}
          </ul>

          {!isAdmin ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
              Contact an admin to either fix the recipe or perform an override release.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-semibold">
                Admin override: you may release with a documented reason. This will be logged.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Override Reason <span className="text-red-500">*</span></label>
                <textarea
                  autoFocus
                  className="w-full h-20 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Why are you releasing with a non-approved brand? (required)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          {isAdmin && (
            <Button
              className="ml-auto bg-amber-600 hover:bg-amber-700"
              disabled={!reason.trim() || saving}
              onClick={handleOverride}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Override & Release'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}