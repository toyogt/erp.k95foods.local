import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, RotateCcw } from 'lucide-react';

/**
 * Editor for a single (page, role) capability map.
 * Renders the capability groups defined in the page registry.
 */
export default function PageFieldPermissionEditor({
  registryEntry,
  defaults,
  values,
  onChange,
  onSave,
  onReset,
  saving,
  dirty,
}) {
  if (!registryEntry) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{registryEntry.label}</h3>
          {registryEntry.description && (
            <p className="text-xs text-slate-500 mt-0.5">{registryEntry.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={onReset}
              disabled={saving}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset changes
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={onSave}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {registryEntry.sections.map(section => (
          <div key={section.title} className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{section.title}</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {section.caps.map(cap => {
                const current = values[cap.key];
                const defaultVal = !!defaults[cap.key];
                const effective = typeof current === 'boolean' ? current : defaultVal;
                const isOverride = typeof current === 'boolean' && current !== defaultVal;
                return (
                  <div
                    key={cap.key}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <Label className="text-sm font-medium text-slate-900 cursor-pointer block">
                        {cap.label}
                      </Label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">{cap.key}</span>
                        {cap.hint && <span className="text-xs text-slate-500">• {cap.hint}</span>}
                        <span className="text-xs text-slate-400">
                          • Default: <span className={defaultVal ? 'text-green-700 font-semibold' : 'text-slate-500'}>
                            {defaultVal ? 'allowed' : 'denied'}
                          </span>
                        </span>
                        {isOverride && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            Overridden
                          </span>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={effective}
                      onCheckedChange={(v) => onChange(cap.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}