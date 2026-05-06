import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PR_STATUS_COLOR, PRIORITY_COLOR, formatDateDDMMYYYY } from './purchaseHelpers';
import ApprovalActionPanel from './ApprovalActionPanel';

export default function PRDetailView({ pr, user, isManager, isHindi, t, onBack, onRefresh, showApprovalActions }) {
  const translate = t || ((k) => k);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prKey = pr.pr_number || pr.mr_id;
    if (!prKey) { setLoading(false); return; }
    Promise.all([
      pr.pr_number ? base44.entities.PurchaseRequestItem.filter({ pr_number: pr.pr_number }, 'line_number', 100).catch(() => []) : Promise.resolve([]),
      pr.mr_id ? base44.entities.PurchaseRequestItem.filter({ mr_id: pr.mr_id }, 'line_number', 100).catch(() => []) : Promise.resolve([]),
    ]).then(([byPr, byMr]) => {
      const merged = byPr.length > 0 ? byPr : byMr;
      setItems(merged);
      setLoading(false);
    });
  }, [pr]);

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack} className="h-9 gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{pr.pr_number || pr.mr_id}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{pr.title || 'Purchase Request'}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${PR_STATUS_COLOR[pr.status] || 'bg-slate-100 text-slate-600'}`}>
            {pr.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-xs text-slate-500">Department</span><p className="font-medium">{pr.department || '—'}</p></div>
          <div><span className="text-xs text-slate-500">Priority</span><p><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOR[pr.priority] || ''}`}>{pr.priority || '—'}</span></p></div>
          <div><span className="text-xs text-slate-500">Request Date</span><p className="font-medium">{formatDateDDMMYYYY(pr.request_date)}</p></div>
          <div><span className="text-xs text-slate-500">Required By</span><p className="font-medium">{formatDateDDMMYYYY(pr.required_by_date)}</p></div>
          <div><span className="text-xs text-slate-500">Requested By</span><p className="font-medium">{pr.requested_by_name || pr.requested_by || '—'}</p></div>
        </div>

        {pr.overall_remarks && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Remarks</p>
            <p className="text-sm text-slate-700">{pr.overall_remarks}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Line Items</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No items found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left px-4 py-2 font-medium">#</th>
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-right px-4 py-2 font-medium">Quantity</th>
                <th className="text-left px-4 py-2 font-medium">Unit</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => (
                  <tr key={it.id || i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-400">{it.line_number || i + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{it.item_name || it.item_code}</td>
                    <td className="px-4 py-2 text-right font-bold">{it.qty || it.quantity || 0}</td>
                    <td className="px-4 py-2 text-slate-600">{it.unit || it.uom_code || '—'}</td>
                    <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{it.item_status || 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showApprovalActions && isManager && (pr.status === 'Pending Approval' || pr.status === 'SUBMITTED') && (
        <ApprovalActionPanel docType="MR" doc={pr} user={user} onDone={onRefresh} />
      )}
    </div>
  );
}