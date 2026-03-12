import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Save, Copy, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  MONTH_CODES, previewExamples, validatePattern, patternToParts,
  partsToPattern, STARTER_TEMPLATES, parseFormatJson,
} from './batchRuleEngine';

const PART_TYPES = [
  { value: 'text',         label: 'TEXT (literal)',      hasValue: true },
  { value: 'dd',           label: 'DD (day 2-digit)' },
  { value: 'mm',           label: 'MM (month 2-digit)' },
  { value: 'month_letter', label: 'MONTH_LETTER (A-L)' },
  { value: 'yy',           label: 'YY (year 2-digit)' },
  { value: 'yyyy',         label: 'YYYY (year 4-digit)' },
  { value: 'seq',          label: 'SEQ (sequence)',      hasPad: true },
  { value: 'sku_prefix',   label: 'SKU_PREFIX (batch prefix)' },
  { value: 'brand_code',   label: 'BRAND_CODE (brand short code)' },
  { value: 'family_code',  label: 'FAMILY_CODE (family short code)' },
  { value: 'flavour_code', label: 'FLAVOUR_CODE (flavour short code)' },
  { value: 'date_serial',  label: 'DATE_SERIAL (Excel integer)' },
  { value: 'dup_suffix',   label: 'DUP_SUFFIX (e.g. -2 if dup)' },
];

function genRuleId() {
  return 'BR-' + String(Date.now()).slice(-6);
}

const EMPTY_PART = { type: 'text', value: '', pad: 2 };

const DEFAULT_FORMAT_OBJ = {
  reset_scope: 'DAILY',
  parts: [],
  month_codes: MONTH_CODES,
  meta: { mode: 'blocks', created_by_builder: true },
};

export default function BatchRuleBuilder({ rule, onSaved, onCancel, saveAsNew, skus = [], isAdmin }) {
  // Header fields
  const [ruleName, setRuleName]           = useState(rule?.rule_name || rule?.description || '');
  const [batchDateSource, setBatchDateSource] = useState(rule?.batch_date_source || 'MFG_START');
  const [resetScope, setResetScope]       = useState(rule?.reset_scope || 'DAILY');
  const [isActive, setIsActive]           = useState(rule?.is_active !== false);
  const [notes, setNotes]                 = useState(rule?.notes || '');

  // Pattern mode only
  const existing = parseFormatJson(rule?.format_json);
  const [pattern, setPattern] = useState(
    existing?.parts ? partsToPattern(existing.parts) : ''
  );
  const [patternErrors, setPatternErrors] = useState([]);

  // Preview
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [previewSku, setPreviewSku]   = useState('');
  const [showJson, setShowJson]       = useState(false);

  // Save state
  const [saving, setSaving]     = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // Pattern validation on change
  useEffect(() => {
    setPatternErrors(validatePattern(pattern));
  }, [pattern]);

  // Active parts for preview
  const activeParts = patternToParts(pattern);
  const formatObj = {
    reset_scope: resetScope,
    parts: activeParts,
    month_codes: MONTH_CODES,
    meta: { mode: 'pattern', created_by_builder: true },
  };

  const selectedSku = skus.find(s => s.item_code === previewSku);
  const skuPrefix   = selectedSku?.batch_prefix || '';
  const skuNeedsPrefix = activeParts.some(p => p.type === 'sku_prefix') && !skuPrefix;

  const examples = previewExamples(formatObj, {
    date: new Date(previewDate + 'T00:00:00'),
    skuPrefix,
    brandCode: selectedSku?.brand_code || '',
    familyCode: selectedSku?.family_code || '',
    flavourCode: selectedSku?.flavour_code || '',
  });

  const canSave = ruleName.trim() && patternErrors.length === 0;

  const doSave = async (asNew) => {
    if (!canSave) return;
    setSaving(true);

    const payload = {
      rule_name: ruleName.trim(),
      description: notes.trim() || ruleName.trim(),
      batch_date_source: batchDateSource,
      reset_scope: resetScope,
      format_json: JSON.stringify(formatObj),
      is_active: isActive,
      notes: notes.trim(),
    };

    let saved;
    if (asNew || !rule) {
      saved = await base44.entities.BatchFormatRule.create({
        ...payload,
        rule_id: genRuleId(),
      });
    } else {
      await base44.entities.BatchFormatRule.update(rule.id, payload);
      saved = { ...rule, ...payload };
    }

    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
    onSaved && onSaved(saved);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs font-medium text-slate-600">Rule Name *</Label>
          <Input
            value={ruleName}
            onChange={e => setRuleName(e.target.value)}
            placeholder="e.g. Swiggy KFB Daily"
            className="text-sm h-9 font-semibold"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Batch Date Source</Label>
          <select
            value={batchDateSource}
            onChange={e => setBatchDateSource(e.target.value)}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9"
          >
            <option value="MFG_START">MFG Start (manufacturing date)</option>
            <option value="LABEL_START">Label Start (labelling date)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Sequence Reset Scope</Label>
          <select
            value={resetScope}
            onChange={e => setResetScope(e.target.value)}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9"
          >
            <option value="DAILY">Daily</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
            <option value="NEVER">Never (continuous)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Status</Label>
          <button
            type="button"
            onClick={() => setIsActive(a => !a)}
            className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors w-full ${isActive ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-500'}`}
          >
            <span className={`inline-block w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
            {isActive ? 'Active' : 'Inactive'}
          </button>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" className="text-sm h-9" />
        </div>
      </div>

      {/* Pattern editor */}
      <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Pattern String</Label>
            <Input
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="{TEXT:KFB}{DD}{MONTH_LETTER}{YY}{SEQ:2}"
              className="text-sm h-9 font-mono"
            />
            {patternErrors.length > 0 && (
              <div className="space-y-0.5">
                {patternErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{e}
                  </p>
                ))}
              </div>
            )}
            {patternErrors.length === 0 && pattern && (
              <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valid pattern</p>
            )}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700 mb-1">Allowed tokens:</p>
            <div className="flex flex-wrap gap-1.5">
              {['{TEXT:KFB}','{DD}','{MM}','{MONTH_LETTER}','{YY}','{YYYY}','{SEQ:2}','{SEQ:3}','{SKU_PREFIX}','{BRAND_CODE}','{FAMILY_CODE}','{FLAVOUR_CODE}','{DATE_SERIAL}','{DUP_SUFFIX}'].map(t => (
                <button
                  key={t}
                  onClick={() => setPattern(p => p + t)}
                  className="font-mono bg-white border border-slate-300 rounded px-1.5 py-0.5 hover:bg-blue-50 hover:border-blue-400 transition-colors text-slate-700"
                >{t}</button>
              ))}
            </div>
            <p className="text-slate-400 mt-2">Tip: click tokens above to insert at end. Literals outside braces are included as-is.</p>
          </div>
      </div>

      {/* Preview panel */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
          Preview
        </div>
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Date</Label>
              <Input
                type="date"
                value={previewDate}
                onChange={e => setPreviewDate(e.target.value)}
                className="text-xs h-8 w-40"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-32">
              <Label className="text-xs text-slate-500">SKU (for prefix)</Label>
              <select
                value={previewSku}
                onChange={e => setPreviewSku(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs bg-white h-8"
              >
                <option value="">— None —</option>
                {skus.map(s => (
                  <option key={s.id} value={s.item_code}>
                    {s.item_code}{s.batch_prefix ? ` (prefix: ${s.batch_prefix})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {skuNeedsPrefix && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> SKU_PREFIX used but selected SKU has no batch_prefix set.
            </p>
          )}

          <div className="space-y-1">
            {examples.map(ex => (
              <div key={ex.seq} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-16">Example {ex.seq}</span>
                <span className="font-mono text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                  {ex.result || <span className="text-slate-300 font-normal">—</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced JSON view (admin only) */}
      {isAdmin && (
        <details>
          <summary
            className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 select-none flex items-center gap-1"
            onClick={e => { e.preventDefault(); setShowJson(v => !v); }}
          >
            {showJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Advanced JSON View (admin)
          </summary>
          {showJson && (
            <pre className="mt-2 text-xs bg-slate-900 text-green-400 rounded-xl p-3 overflow-x-auto max-h-48">
              {JSON.stringify(formatObj, null, 2)}
            </pre>
          )}
        </details>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center gap-2">
          {savedMsg && (
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />{savedMsg}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-8">Cancel</Button>
          )}
          {rule && (
            <Button variant="outline" size="sm" onClick={() => doSave(true)} disabled={saving || !canSave} className="text-xs h-8 gap-1.5">
              <Copy className="w-3 h-3" /> Save As New Rule
            </Button>
          )}
          <Button size="sm" onClick={() => doSave(false)} disabled={saving || !canSave} className="text-xs h-8 gap-1.5">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {rule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}