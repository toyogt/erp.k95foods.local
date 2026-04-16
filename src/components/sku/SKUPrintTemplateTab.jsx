/**
 * SKUPrintTemplateTab
 * 
 * Read-only display of templates assigned to this SKU via SKUPrintMapping.
 * To assign templates: Use SKUPrintMappingTab
 * To create/edit templates: Go to Labelling Master Data → Print Template Builder
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, FileCode2, ExternalLink, Info } from 'lucide-react';

export default function SKUPrintTemplateTab({ sku }) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['lbl-print-templates-active'],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }, '-created_date', 200),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['sku-print-mappings', sku?.id],
    queryFn: () => base44.entities.SKUPrintMapping.filter({ sku_code: sku?.item_code }),
    enabled: !!sku?.id,
  });

  if (!sku?.id) return <p className="text-slate-600 text-sm">Select a SKU first</p>;

  const getTemplate = (templateId) => templates.find(t => t.id === templateId);

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
    </div>
  );

  if (templates.length === 0) return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
      <FileCode2 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
      <p className="text-sm text-amber-800 font-medium">No Rynan print templates available.</p>
      <p className="text-xs text-amber-600 mt-1">
        Go to <strong>Labelling Master Data → Print Template Builder</strong> to create templates first.
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
      {/* Info Banner */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-blue-900">Templates Assigned to This SKU</p>
          <p className="text-xs text-blue-700 mt-1">
            These templates are available when creating label plans. To add templates, use <strong>SKU Print Mapping</strong> tab.
          </p>
        </div>
      </div>

      {/* Template List */}
      {mappings.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
          <p className="text-sm text-slate-600">No templates assigned to this SKU yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Go to <strong>SKU Print Mapping</strong> tab to assign templates.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {mappings.map(mapping => {
            const template = getTemplate(mapping.template_id);
            if (!template) return null;
            return (
              <div key={mapping.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                {/* Template Name + Default Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{template.name}</p>
                    <p className="text-xs text-slate-600">
                      Middleware: <span className="font-mono">{template.middleware_template_name}</span>
                    </p>
                  </div>
                  {mapping.is_default && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap">
                      Default
                    </span>
                  )}
                </div>

                {/* POD Fields (if any) */}
                {(template.field_mappings || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-700 mb-2">POD Mappings:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(template.field_mappings || []).map((f, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono">
                          {f.pod_field}: {f.erp_source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}