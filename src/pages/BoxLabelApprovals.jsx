import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw } from 'lucide-react';
import ApprovalSidePanel from '@/components/labels/ApprovalSidePanel';

const STATUS_STYLE = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  PRINTED:  'bg-slate-100 text-slate-600',
};

function fmtDate(d) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}

function RequestCard({ req, products, onClick }) {
  const product = products.find(p => p.item_code === req.item_code);
  return (
    <div
      onClick={() => onClick(req)}
      className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-400 truncate">{req.request_id}</p>
          <p className="font-bold text-slate-800 text-sm truncate">{req.item_code}</p>
          {product && <p className="text-xs text-slate-500 truncate">{product.product_name}{product.flavour ? ` · ${product.flavour}` : ''}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[req.status] || 'bg-slate-100 text-slate-500'}`}>
            {req.status}
          </span>
          {req.is_trial_pack && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">TRIAL</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs">
        <div><span className="text-slate-400">Batch</span><br/><b className="text-slate-700">{req.batch_no}</b></div>
        <div><span className="text-slate-400">Mfg</span><br/><span className="text-slate-700">{fmtDate(req.mfg_date)}</span></div>
        <div><span className="text-slate-400">Qty</span><br/><b className="text-slate-700">{req.qty_labels}</b></div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{req.requested_by}</span>
        <span>{req.requested_at ? new Date(req.requested_at).toLocaleString('en-IN', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'}</span>
      </div>
    </div>
  );
}

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Label Approvals</h2>
          <p className="text-sm text-slate-500">Review and approve label print requests.</p>
        </div>
        <button onClick={loadAll} className="text-slate-400 hover:text-slate-600 p-1">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {['PENDING', 'HISTORY'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'PENDING' ? `Pending (${pendingReqs.length})` : `History (${historyReqs.length})`}
          </button>
        ))}
      </div>

      {/* Card list – no table, no horizontal scroll */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          {activeTab === 'PENDING' ? 'No pending requests.' : 'No history yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(req => (
            <RequestCard key={req.id} req={req} products={products} onClick={setSelected} />
          ))}
        </div>
      )}

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