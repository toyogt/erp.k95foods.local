import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_COLOR, logPurchaseAudit } from './purchaseHelpers';

export default function MRList({ user, isManager, onCreatePO }) {
  const [mrs, setMrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [items, setItems] = useState({});
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(null);

  async function load() {
    setLoading(true);
    const data = await base44.entities.PurchaseRequest.list('-created_date', 100);
    setMrs(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function loadItems(mrId) {
    if (items[mrId]) return;
    const its = await base44.entities.PurchaseRequestItem.filter({ mr_id: mrId });
    setItems(prev => ({ ...prev, [mrId]: its }));
  }

  function toggleExpand(mrId) {
    if (expanded === mrId) { setExpanded(null); return; }
    setExpanded(mrId);
    loadItems(mrId);
  }

  async function handleApprove(mr) {
    setActing(mr.id);
    const now = new Date().toISOString();
    await base44.entities.PurchaseRequest.update(mr.id, {
      status: 'APPROVED', approved_by: user?.email, approved_at: now
    });
    await logPurchaseAudit({ action: `MR ${mr.mr_id} APPROVED`, entity_type: 'PurchaseRequest', entity_id: mr.mr_id, user });
    setActing(null);
    load();
  }

  async function handleReject(mr) {
    if (!rejectReason.trim()) { alert('Enter rejection reason'); return; }
    setActing(mr.id);
    await base44.entities.PurchaseRequest.update(mr.id, {
      status: 'REJECTED', rejection_reason: rejectReason
    });
    await logPurchaseAudit({ action: `MR ${mr.mr_id} REJECTED — ${rejectReason}`, entity_type: 'PurchaseRequest', entity_id: mr.mr_id, user });
    setRejectReason('');
    setActing(null);
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      {mrs.length === 0 && <p className="text-center text-slate-400 py-8">No material requests yet.</p>}
      {mrs.map(mr => (
        <div key={mr.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button onClick={() => toggleExpand(mr.mr_id)} className="w-full text-left p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{mr.mr_id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[mr.status] || 'bg-slate-100 text-slate-600'}`}>{mr.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{mr.request_date} · {mr.requested_by} {mr.department ? `· ${mr.department}` : ''}</p>
            </div>
            {expanded === mr.mr_id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {expanded === mr.mr_id && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {/* Items */}
              <div className="space-y-1">
                {(items[mr.mr_id] || []).map((it, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 px-2 bg-slate-50 rounded-lg">
                    <span className="font-medium">{it.item_name || it.item_code}</span>
                    <span className="text-slate-500">{it.qty} {it.uom_code} · {it.required_by}</span>
                  </div>
                ))}
                {!items[mr.mr_id] && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto" />}
              </div>
              {mr.notes && <p className="text-xs text-slate-500 italic">Notes: {mr.notes}</p>}
              {mr.rejection_reason && <p className="text-xs text-red-600">Reason: {mr.rejection_reason}</p>}

              {/* Manager actions */}
              {isManager && mr.status === 'SUBMITTED' && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Button onClick={() => handleApprove(mr)} disabled={!!acting} className="flex-1 bg-green-600 hover:bg-green-700 h-9">
                      {acting === mr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                    </Button>
                    <Button variant="outline" onClick={() => {}} className="flex-1 border-red-200 text-red-600 h-9"
                      onClickCapture={() => {}}>
                      Reject ↓
                    </Button>
                  </div>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Rejection reason (required to reject)"
                    value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  {rejectReason && (
                    <Button onClick={() => handleReject(mr)} disabled={!!acting} className="w-full bg-red-600 hover:bg-red-700 h-9">
                      Confirm Reject
                    </Button>
                  )}
                </div>
              )}

              {/* Create PO */}
              {isManager && mr.status === 'APPROVED' && (
                <Button onClick={() => onCreatePO(mr, items[mr.mr_id] || [])} className="w-full bg-blue-600 hover:bg-blue-700 h-9">
                  Create Purchase Order →
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}