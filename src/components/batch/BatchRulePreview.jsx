import { parseFormatJson, previewExamples } from './batchRuleEngine';
import { AlertTriangle } from 'lucide-react';

/**
 * Compact inline preview for a selected rule.
 * Shows 3 examples for today, seq 1-3.
 */
export default function BatchRulePreview({ rule, sku }) {
  if (!rule) return null;

  const formatObj = parseFormatJson(rule.format_json);
  if (!formatObj || !formatObj.parts?.length) {
    return (
      <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        Rule has no format configured yet — edit it to add parts.
      </div>
    );
  }

  const skuPrefix = sku?.batch_prefix || '';
  const needsPrefix = formatObj.parts.some(p => p.type === 'sku_prefix') && !skuPrefix;
  const examples = previewExamples(formatObj, { date: new Date(), skuPrefix }).slice(0, 3);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">Rule Preview — today</span>
        <span className="text-xs text-slate-400">{rule.rule_name || rule.rule_id}</span>
      </div>
      {needsPrefix && (
        <p className="text-xs text-amber-600 flex items-center gap-1 mb-1">
          <AlertTriangle className="w-3 h-3" /> SKU has no batch prefix set
        </p>
      )}
      <div className="flex gap-3 flex-wrap">
        {examples.map(ex => (
          <span key={ex.seq} className="font-mono text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2 py-0.5">
            {ex.result || '—'}
          </span>
        ))}
      </div>
    </div>
  );
}