import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw } from 'lucide-react';
import { STATUS_COLOR } from './purchaseHelpers';

export default function PurchaseReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [mrs, pos] = await Promise.all([
      base44.entities.PurchaseRequest.list('-created_date', 200),
      base44.entities.PurchaseOrder.list('-created_date', 200),
    ]);
    setData({
      mrPendingApproval: mrs.filter(m => m.status === 'SUBMITTED'),
      poPendingApproval: pos.filter(p => p.status === 'SUBMITTED'),
      poPendingReceipt: pos.filter(p => ['APPROVED', 'SENT', 'PART_RECEIVED'].includes(p.status)),
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  function Section({ title, rows, cols }) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</p>
          <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
        </div>
        {rows.length === 0 && <p className="text-slate-400 text-sm text-center py-2">None</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
            <div>
              <span className="font-mono font-bold text-sm text-slate-800">{r.mr_id || r.po_id}</span>
              {r.supplier_name && <span className="text-xs text-slate-400 ml-2">{r.supplier_name}</span>}
              {r.requested_by && <span className="text-xs text-slate-400 ml-2">{r.requested_by}</span>}
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] || ''}`}>{r.status}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-slate-700">Purchase Reports</p>
        <button onClick={load} className="text-slate-400 hover:text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <Section title="MRs Pending Approval" rows={data.mrPendingApproval} />
      <Section title="POs Pending Approval" rows={data.poPendingApproval} />
      <Section title="POs Pending Receipt" rows={data.poPendingReceipt} />
    </div>
  );
}