import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw } from 'lucide-react';
import ApprovalSidePanel from '@/components/labels/ApprovalSidePanel';

const TABS = ['PENDING', 'HISTORY'];

const STATUS_STYLE = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  PRINTED:  'bg-slate-100 text-slate-600',
};

export default function BoxLabelApprovals() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [pendingReqs, setPendingReqs] = useState([]);
  const [historyReqs, setHistoryReqs] = useState([]);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [u, prods, pending, history] = await Promise.all([
      base44.auth.me(),
      base44.entities.ProductMaster.filter({ is_active: true }, 'product_name', 200),
      base44.entities.LabelPrintRequest.filter({ status: 'PENDING' }, '-requested_at', 100),
      base44.entities.LabelPrintRequest.filter({}, '-requested_at', 50),
    ]);
    setUser(u);
    setProducts(prods);
    setPendingReqs(pending);
    setHistoryReqs(history.filter(r => r.status !== 'PENDING'));
    setLoading(false);
  }

  function handleDone() {
    setSelected(null);
    loadAll();
  }

  const rows = activeTab === 'PENDING' ? pendingReqs : historyReqs;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Label Approvals</h2>
          <p className="text-sm text-slate-500">Review and approve label print requests.</p>
        </div>
        <button onClick={loadAll} className="text-slate-400 hover:text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'PENDING' ? `Pending (${pendingReqs.length})` : 'History'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {activeTab === 'PENDING' ? 'No pending requests.' : 'No history yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Request ID</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Batch</th>
                  <th className="text-left px-4 py-3">Mfg</th>
                  <th className="text-left px-4 py-3">Exp</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Requested By</th>
                  <th className="text-left px-4 py-3">Requested At</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(req => (
                  <tr
                    key={req.id}
                    onClick={() => setSelected(req)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold">{req.request_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{req.item_code}</div>
                      <div className="text-xs text-slate-500">
                        {products.find(p => p.item_code === req.item_code)?.product_name || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{req.batch_no}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{req.mfg_date || '—'}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${!req.exp_date ? 'text-red-500' : 'text-slate-600'}`}>
                      {req.exp_date || '⚠ Missing'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{req.qty_labels}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{req.requested_by}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {req.requested_at ? new Date(req.requested_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[req.status] || 'bg-slate-100 text-slate-500'}`}>
                        {req.status}
                      </span>
                      {req.is_trial_pack && (
                        <span className="ml-1.5 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">TRIAL</span>
                      )}
                      {req.qty_labels > 500 && req.status === 'PENDING' && (
                        <span className="ml-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">LARGE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <ApprovalSidePanel
          request={selected}
          products={products}
          user={user}
          onDone={handleDone}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}