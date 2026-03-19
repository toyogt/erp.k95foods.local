import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

export default function ApprovalRulesList({ rules }) {
  const getActionColor = (style) => {
    switch (style) {
      case 'approve': return 'bg-green-100 text-green-700';
      case 'reject': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (rules.length === 0) {
    return <div className="text-center py-12 text-slate-400">No rules found</div>;
  }

  return (
    <div className="space-y-3">
      {rules.map(rule => (
        <div key={rule.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-slate-900">{rule.doc_type}</span>
                <Badge variant="outline" className="text-xs">{rule.from_state}</Badge>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <Badge variant="outline" className="text-xs">{rule.to_state}</Badge>
              </div>
              <p className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${getActionColor(rule.action_style)}`}>
                {rule.action_label}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="text-right">
                <p className="text-xs text-slate-500">Can approve:</p>
                <div className="flex gap-1 mt-1 flex-wrap justify-end">
                  {rule.allowed_roles?.map(role => (
                    <Badge key={role} className="bg-slate-100 text-slate-700 text-xs">{role}</Badge>
                  ))}
                </div>
              </div>
              {rule.require_reason && (
                <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">Requires reason</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}