import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileCode2, ExternalLink, CheckCircle2 } from 'lucide-react';

const COMMAND_TYPE_LABELS = {
  demo_print: 'Demo Print',
  bulk_start: 'Bulk Start',
  bulk_stop: 'Bulk Stop',
  purge: 'Purge',
  test_ping: 'Test Ping',
  custom: 'Custom',
};

const COMMAND_TYPE_COLORS = {
  demo_print: 'bg-blue-100 text-blue-700',
  bulk_start: 'bg-green-100 text-green-700',
  bulk_stop: 'bg-red-100 text-red-700',
  purge: 'bg-orange-100 text-orange-700',
  test_ping: 'bg-slate-100 text-slate-700',
  custom: 'bg-purple-100 text-purple-700',
};

/**
 * SKUPrintTemplateTab — shown inside SKU Setup's Printing & Batch tab.
 * Allows selecting multiple LblPrintTemplate records per SKU (one per command type).
 * Stores the mapping as { demo_print: templateId, bulk_start: templateId, ... } in skuForm.print_template_mappings.
 */
export default function SKUPrintTemplateTab({ mappings = {}, onChange }) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['lbl-print-templates-active'],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }, '-created_date', 200),
  });

  const templatesByCommandType = templates.reduce((acc, t) => {
    if (!acc[t.command_type]) acc[t.command_type] = [];
    acc[t.command_type].push(t);
    return acc;
  }, {});

  const commandTypes = ['demo_print', 'bulk_start', 'bulk_stop', 'purge', 'test_ping', 'custom'];

  const handleSelect = (commandType, templateId) => {
    onChange({ ...mappings, [commandType]: templateId });
  };

  const getSelectedTemplate = (commandType) => {
    const id = mappings[commandType];
    return templates.find(t => t.template_id === id);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
    </div>
  );

  if (templates.length === 0) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
      <FileCode2 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
      <p className="text-sm text-amber-800 font-medium">No Rynan print templates configured yet.</p>
      <p className="text-xs text-amber-600 mt-1">
        Go to <strong>Labelling Master Data → Rynan Templates</strong> to add templates first.
      </p>
      <button
        className="mt-3 text-xs text-amber-700 underline flex items-center gap-1 mx-auto"
        onClick={() => window.open('/LblMasterData', '_blank')}
      >
        Open Labelling Master Data <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-xs text-blue-800">
          Map each print command type to a Rynan template. The system will auto-populate the template's
          POD fields with ERP data when sending commands during the labelling workflow.
        </p>
      </div>

      <div className="space-y-3">
        {commandTypes.map(cmdType => {
          const available = templatesByCommandType[cmdType] || [];
          const selected = getSelectedTemplate(cmdType);
          const currentValue = mappings[cmdType] || '';

          return (
            <div key={cmdType} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${COMMAND_TYPE_COLORS[cmdType]}`}>
                  {COMMAND_TYPE_LABELS[cmdType]}
                </span>
                {selected && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>

              {available.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No templates available for this command type.</p>
              ) : (
                <select
                  value={currentValue}
                  onChange={e => handleSelect(cmdType, e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-9 bg-white"
                >
                  <option value="">— None (not mapped) —</option>
                  {available.map(t => (
                    <option key={t.template_id} value={t.template_id}>
                      {t.template_id} — {t.name} [{t.middleware_template_name}]
                    </option>
                  ))}
                </select>
              )}

              {selected && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1">
                  <p className="text-xs text-slate-500">
                    Middleware: <span className="font-mono font-semibold text-slate-700">{selected.middleware_template_name}</span>
                    {' · '}{(selected.field_mappings || []).length} fields configured
                  </p>
                  {(selected.field_mappings || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(selected.field_mappings || []).map((f, i) => (
                        <span key={i} className="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {f.pod_field}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}