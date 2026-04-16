import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

/**
 * SKUTemplatePODMappingPreview
 * Displays the POD field mappings from a selected template
 * Shows table with: POD, Field Name, Template Key, Value (sample)
 */
export default function SKUTemplatePODMappingPreview({ templateId }) {
  const { data: template, isLoading } = useQuery({
    queryKey: ['lbl-print-template', templateId],
    queryFn: async () => {
      // Fetch the template by its database ID
      const templates = await base44.entities.LblPrintTemplate.filter({ is_active: true });
      return templates?.find(t => t.id === templateId) || null;
    },
    enabled: !!templateId,
  });

  if (!templateId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!template?.field_mappings || template.field_mappings.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-700">No POD field mappings configured for this template.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-700">POD Field Mappings — Template: {template.name}</p>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">POD</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Field Name</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Template Key</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Editable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {template.field_mappings.map((field, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-semibold text-slate-700 bg-slate-50">{field.pod_field}</td>
                <td className="px-3 py-2 text-slate-700">{field.label || '—'}</td>
                <td className="px-3 py-2 font-mono text-blue-600">{field.erp_source || '—'}</td>
                <td className="px-3 py-2">
                  {field.is_editable !== false ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Yes</span>
                  ) : (
                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}