/**
 * Sales Audit Log Viewer — Displays activity/change history for sales documents
 * Reusable across SalesOrder, SalesDeliveryNote, SalesPicklist, etc.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, History } from 'lucide-react';

export default function SalesAuditLogViewer({ entityType, entityId, referenceNumber }) {
  const [expanded, setExpanded] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sales_audit_logs', entityType, entityId],
    queryFn: () => base44.entities.SalesAuditLog.filter(
      { entity_type: entityType, entity_id: entityId },
      '-created_date',
      100
    ),
    enabled: expanded && !!entityId,
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
             ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  const getActionLabel = (action) => {
    const labels = {
      'workflow_waiting_for_transporter': 'Set to Waiting for Transporter',
      'workflow_waiting_for_loading': 'Marked Transporter Arrived',
      'workflow_loading_completed': 'Marked Loading Completed',
      'workflow_bills_generated': 'Generated Bills',
      'cancelled': 'Cancelled',
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <span className="font-medium text-slate-900">Activity Log</span>
          {!isLoading && logs.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{logs.length}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Loading activity...</div>
          ) : logs.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">No activity yet</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-sm text-slate-900">{getActionLabel(log.action)}</span>
                  <span className="text-xs text-slate-400">{formatDate(log.created_date)}</span>
                </div>
                <p className="text-xs text-slate-600">{log.user_email}</p>
                {log.notes && <p className="text-xs text-slate-500 mt-1">{log.notes}</p>}
                {log.old_value && log.new_value && (
                  <p className="text-xs text-slate-500 mt-1">
                    {log.old_value} → {log.new_value}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}