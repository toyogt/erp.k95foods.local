import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Inbox, ClipboardList, ShoppingCart, Package, FileText, CreditCard } from 'lucide-react';
import { STATUS_COLOR } from '@/components/purchase/purchaseHelpers';
import ApprovalActionPanel from '@/components/purchase/ApprovalActionPanel';

const SECTIONS = [
  { key: 'mr',      label: 'Material Requests',    icon: ClipboardList, active: true },
  { key: 'po',      label: 'Purchase Orders',       icon: ShoppingCart,  active: true },
  { key: 'grn',     label: 'GRN / QC',             icon: Package,       active: false },
  { key: 'invoice', label: 'Invoice Verification',  icon: FileText,      active: false },
  { key: 'payment', label: 'Payment Approval',      icon: CreditCard,    active: false },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function InboxRow({ docType, doc, itemCount, totalQty, user, onDone }) {
  const [expanded, setExpanded] = useState(false);
  const idField = docType === 'MR' ? 'mr_id' : 'po_id';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${docType === 'MR' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                {docType}
              </span>
              <span className="font-bold text-slate-900 font-mono">{doc[idField]}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[doc.status] || ''}`}>{doc.status}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
              <span>{doc.requested_by || doc.created_by || '—'}</span>
              {doc.supplier_name && <span>· {doc.supplier_name}</span>}
              {itemCount > 0 && <span>· {itemCount} items · {totalQty} qty</span>}
              {doc.total_amount && <span>· ₹{Number(doc.total_amount).toFixed(0)}</span>}
              <span>· {timeAgo(doc.created_date)}</span>
            </div>
          </div>
          <div className="text-slate-400 text-lg shrink-0">{expanded ? '▲' : '▼'}</div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          {doc.notes && <p className="text-xs text-slate-500 italic mb-2">Notes: {doc.notes}</p>}
          <ApprovalActionPanel docType={docType} doc={doc} user={user} onDone={onDone} />
        </div>
      )}
    </div>
  );
}

export default function ApprovalsInbox() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('mr');
  const [mrs, setMrs] = useState([]);
  const [pos, setPos] = useState([]);
  const [mrItems, setMrItems] = useState({});
  const [poItems, setPoItems] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [u, pendingMRs, pendingPOs] = await Promise.all([
      base44.auth.me(),
      base44.entities.PurchaseRequest.filter({ status: 'SUBMITTED' }, '-created_date', 100),
      base44.entities.PurchaseOrder.filter({ status: 'SUBMITTED' }, '-created_date', 100),
    ]);
    setUser(u);
    setMrs(pendingMRs);
    setPos(pendingPOs);

    // Load items for counts
    const mrIds = pendingMRs.map(m => m.mr_id);
    const poIds = pendingPOs.map(p => p.po_id);

    const [allMrItems, allPoItems] = await Promise.all([
      mrIds.length ? Promise.all(mrIds.map(id => base44.entities.PurchaseRequestItem.filter({ mr_id: id }))) : Promise.resolve([]),
      poIds.length ? Promise.all(poIds.map(id => base44.entities.PurchaseOrderItem.filter({ po_id: id }))) : Promise.resolve([]),
    ]);

    const mrMap = {};
    mrIds.forEach((id, i) => { mrMap[id] = allMrItems[i] || []; });
    const poMap = {};
    poIds.forEach((id, i) => { poMap[id] = allPoItems[i] || []; });

    setMrItems(mrMap);
    setPoItems(poMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager' || user?.role === 'accounts_manager';

  const totalPending = mrs.length + pos.length;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Approvals Inbox</h1>
            {totalPending > 0 && !loading && (
              <span className="text-xs font-black bg-red-500 text-white px-2 py-0.5 rounded-full">{totalPending}</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">All documents awaiting your approval</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map(sec => {
          const count = sec.key === 'mr' ? mrs.length : sec.key === 'po' ? pos.length : 0;
          const Icon = sec.icon;
          return (
            <button key={sec.key} onClick={() => sec.active && setTab(sec.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                tab === sec.key ? 'bg-slate-900 text-white' :
                sec.active ? 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400' :
                'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}>
              <Icon className="w-4 h-4" />
              {sec.label}
              {count > 0 && (
                <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${tab === sec.key ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                  {count}
                </span>
              )}
              {!sec.active && <span className="text-xs opacity-50 ml-1">Soon</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : (
        <>
          {/* MR section */}
          {tab === 'mr' && (
            <div className="space-y-3">
              {mrs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold">No MRs pending approval</p>
                </div>
              ) : mrs.map(mr => {
                const its = mrItems[mr.mr_id] || [];
                const totalQty = its.reduce((s, it) => s + (Number(it.qty) || 0), 0);
                return (
                  <InboxRow key={mr.id} docType="MR" doc={mr}
                    itemCount={its.length} totalQty={totalQty} user={user} onDone={load} />
                );
              })}
            </div>
          )}

          {/* PO section */}
          {tab === 'po' && (
            <div className="space-y-3">
              {pos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold">No POs pending approval</p>
                </div>
              ) : pos.map(po => {
                const its = poItems[po.po_id] || [];
                const totalQty = its.reduce((s, it) => s + (Number(it.qty) || 0), 0);
                return (
                  <InboxRow key={po.id} docType="PO" doc={po}
                    itemCount={its.length} totalQty={totalQty} user={user} onDone={load} />
                );
              })}
            </div>
          )}

          {/* Future sections */}
          {!['mr', 'po'].includes(tab) && (
            <div className="text-center py-12 text-slate-400">
              <Inbox className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">Coming soon</p>
              <p className="text-xs mt-1">This approval queue will be active in a future release.</p>
            </div>
          )}
        </>
      )}

      {!isManager && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm font-medium text-center">
          You need Purchase Manager or Admin role to approve documents.
        </div>
      )}
    </div>
  );
}