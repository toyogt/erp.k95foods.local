import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X } from 'lucide-react';

export default function PermissionMatrixTable({ roles, accessRules }) {
  const documentTypes = useMemo(() => {
    return [...new Set(accessRules.map(r => r.doc_type))].sort();
  }, [accessRules]);

  const getRuleForRoleAndDoc = (roleKey, docType) => {
    return accessRules.filter(r => 
      r.doc_type === docType && 
      r.allowed_roles?.includes(roleKey) &&
      r.is_active
    );
  };

  const getPermissionColor = (can) => {
    return can ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-100 z-10">Document Type</th>
            {roles.map(r => (
              <th key={r.role_key} className="px-3 py-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                <span className="text-xs">{r.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documentTypes.map(docType => (
            <tr key={docType} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10">{docType}</td>
              {roles.map(r => {
                const rules = getRuleForRoleAndDoc(r.role_key, docType);
                const canView = rules.some(rule => rule.can_view);
                const canEdit = rules.some(rule => rule.can_edit);
                const canCreate = rules.some(rule => rule.can_create);
                const canApprove = rules.some(rule => rule.can_approve);

                return (
                  <td key={`${r.role_key}-${docType}`} className="px-3 py-3 text-center">
                    <TooltipProvider>
                      <div className="flex justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${getPermissionColor(canView)}`}>
                              {canView ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${getPermissionColor(canEdit)}`}>
                              {canEdit ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${getPermissionColor(canCreate)}`}>
                              {canCreate ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Create</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${getPermissionColor(canApprove)}`}>
                              {canApprove ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Approve</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}