import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const checks = [
  { key: 'recipe_group_id', label: 'Recipe Group', skipForTrialPack: true },
  { key: 'default_recipe_option_id', label: 'Default Recipe Option', skipForTrialPack: true },
  { key: 'bottle_type', label: 'Container Type', skipForTrialPack: true },
  { key: 'cap_sku_code', label: 'Cap Type', skipForTrialPack: true },
  { key: 'box_type_id', label: 'Box Type' },
  { key: 'shelf_life_days', label: 'Shelf Life', skipForTrialPack: true },
];

const mappingChecks = [
  { key: 'ryan_template_id', label: 'Ryan Template', skipForTrialPack: true },
  { key: 'batch_format_rule_id', label: 'Batch Format Rule', skipForTrialPack: true },
];

export function isSetupComplete(sku, mapping) {
  return true;
}

export default function SetupChecklist({ sku, mapping }) {
  const isTrialPack = sku?.is_trial_pack;
  const relevantChecks = isTrialPack ? checks.filter(c => !c.skipForTrialPack) : checks;
  const relevantMappingChecks = isTrialPack ? mappingChecks.filter(c => !c.skipForTrialPack) : mappingChecks;
  
  const all = [
    ...relevantChecks.map(c => ({ label: c.label, ok: !!sku?.[c.key] })),
    ...relevantMappingChecks.map(c => ({ label: c.label, ok: !!(mapping || {})[c.key] })),
    { label: 'Default Artwork', ok: !!sku?.default_artwork_id, optional: true, skipForTrialPack: true },
  ].filter(c => !isTrialPack || !c.skipForTrialPack);

  const required = all.filter(c => !c.optional);
  const complete = required.every(c => c.ok);

  return (
    <div className={`rounded-xl border p-3 ${complete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {complete
          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
          : <AlertTriangle className="w-4 h-4 text-amber-600" />}
        <span className={`text-xs font-semibold ${complete ? 'text-green-700' : 'text-amber-700'}`}>
          {complete ? 'Setup complete — can be activated' : 'Setup incomplete — cannot activate yet'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
        {all.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.ok
              ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
              : c.optional
                ? <AlertTriangle className="w-3 h-3 text-slate-300 shrink-0" />
                : <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
            <span className={`text-xs ${c.ok ? 'text-slate-600' : c.optional ? 'text-slate-400' : 'text-red-600'}`}>
              {c.label}{c.optional ? ' (opt)' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}