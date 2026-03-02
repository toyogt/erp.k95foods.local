import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Loads and displays the SKUPrintMapping for a given product_code.
 * Props: productCode, onMappingLoaded(mapping | null)
 */
export default function SKUMappingBadge({ productCode, onMappingLoaded }) {
  const [mapping, setMapping] = useState(undefined); // undefined=loading, null=not found
  const [variant, setVariant] = useState(null);
  const [ryanTpl, setRyanTpl] = useState(null);
  const [batchRule, setBatchRule] = useState(null);

  useEffect(() => {
    if (!productCode) { setMapping(null); onMappingLoaded?.(null); return; }
    let cancelled = false;
    (async () => {
      const maps = await base44.entities.SKUPrintMapping.filter({ product_code: productCode, is_active: true }).catch(() => []);
      if (cancelled) return;
      if (!maps.length) { setMapping(null); onMappingLoaded?.(null); return; }
      const m = maps[0];
      setMapping(m);
      onMappingLoaded?.(m);
      const [vs, ts, bs] = await Promise.all([
        m.label_variant_id ? base44.entities.LabelVariant.filter({ label_variant_id: m.label_variant_id }).catch(() => []) : [],
        m.ryan_template_id ? base44.entities.RyanTemplate.filter({ ryan_template_id: m.ryan_template_id }).catch(() => []) : [],
        m.batch_format_rule_id ? base44.entities.BatchFormatRule.filter({ rule_id: m.batch_format_rule_id }).catch(() => []) : [],
      ]);
      if (!cancelled) { setVariant(vs[0] || null); setRyanTpl(ts[0] || null); setBatchRule(bs[0] || null); }
    })();
    return () => { cancelled = true; };
  }, [productCode]);

  if (!productCode) return null;

  if (mapping === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading template mapping…
      </div>
    );
  }

  if (!mapping) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        <div>
          <p className="text-xs font-bold text-red-700">No active SKU mapping for {productCode}</p>
          <p className="text-xs text-red-500">Ask admin to configure in Template Mapping Manager before starting.</p>
        </div>
      </div>
    );
  }

  const isComplete = mapping.label_variant_id && mapping.ryan_template_id;

  return (
    <div className={`rounded-xl border p-3 space-y-1 ${isComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-2">
        {isComplete
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
        <p className={`text-xs font-bold ${isComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
          {isComplete ? 'Template mapping found' : 'Incomplete mapping — cannot start'}
        </p>
      </div>
      <div className="pl-6 space-y-0.5 text-xs text-slate-600">
        <p>Label variant: <span className="font-mono font-semibold">{mapping.label_variant_id}</span>{variant?.label_template_name ? <span className="text-blue-600"> → {variant.label_template_name}</span> : ''}</p>
        {mapping.ryan_template_id && <p>Ryan template: <span className="font-mono font-semibold">{mapping.ryan_template_id}</span>{ryanTpl?.description ? ` — ${ryanTpl.description}` : ''}</p>}
        {mapping.batch_format_rule_id && <p>Batch format: <span className="font-mono">{mapping.batch_format_rule_id}</span>{batchRule?.description ? ` — ${batchRule.description}` : ''}</p>}
      </div>
    </div>
  );
}