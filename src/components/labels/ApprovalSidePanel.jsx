import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function ApprovalSidePanel({ request, products, user, onDone, onClose }) {
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [confirmBig, setConfirmBig] = useState(false);
  const [loading, setLoading] = useState(false);

  const product = products.find(p => p.item_code === request.item_code);
  const isBigQty = request.qty_labels > 500;
  const missingExp = !request.exp_date;

  async function fireAlert(severity, message) {
    await base44.entities.AlertEvent.create({
      severity,
      station_type: 'BOX_LABELS',
      message,
      reference_type: 'LabelPrintRequest',
      reference_id: request.request_id,
      status: 'OPEN',
    }).catch(() => {});
  }

  async function handleApprove() {
    if (isBigQty && !confirmBig) { setConfirmBig(true); return; }
    setLoading(true);
    await base44.entities.LabelPrintRequest.update(request.id, {
      status: 'APPROVED',
      approved_by: user?.email || '',
      approved_at: new Date().toISOString(),
    });
    await fireAlert('INFO', `Label request approved: ${request.request_id}`);
    setLoading(false);
    onDone();
  }

  async function handleReject() {
    if (!rejectNote.trim()) return;
    setLoading(true);
    await base44.entities.LabelPrintRequest.update(request.id, {
      status: 'REJECTED',
      decision_notes: rejectNote.trim(),
      approved_by: user?.email || '',
      approved_at: new Date().toISOString(),
    });
    await fireAlert('WARN', `Label request rejected: ${request.request_id}`);
    setLoading(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="font-bold text-slate-900 text-base">{request.request_id}</p>
            <p className="text-xs text-slate-500">Requested by {request.requested_by} · {request.requested_at ? new Date(request.requested_at).toLocaleString() : '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Product info */}
          <Section title="Product">
            <Row label="Item Code" value={request.item_code} bold />
            <Row label="Product" value={product?.product_name || '—'} />
            {product?.flavour && <Row label="Flavour" value={product.flavour} />}
            <Row label="Batch No" value={request.batch_no} bold />
            <Row label="Mfg Date" value={request.mfg_date || '—'} />
            <Row label="Exp Date" value={request.exp_date || '—'} alert={missingExp} />
            <Row label="Qty Labels" value={request.qty_labels} bold />
            {request.is_trial_pack && (
              <div className="mt-1">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">TRIAL PACK</span>
              </div>
            )}
          </Section>

          {/* Product master details */}
          {product && (
            <Section title="Product Details">
              <Row label="Shelf Life" value={product.shelf_life_days ? `${product.shelf_life_days} days` : '—'} />
              <Row label="Bottles/Box" value={product.bottles_per_box ?? '—'} />
              <Row label="Vol/Bottle" value={product.ml_per_bottle ? `${product.ml_per_bottle} ml` : '—'} />
              <Row label="MRP (Box)" value={product.mrp_box ? `₹${product.mrp_box}` : '—'} />
              <Row label="FSSAI" value={product.fssai_no || '—'} />
            </Section>
          )}

          {/* Trial pack contents */}
          {request.is_trial_pack && request.contents_json?.length > 0 && (
            <Section title="Trial Pack Contents">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="text-left pb-1 pr-2">Item</th>
                      <th className="text-left pb-1 pr-2">Batch</th>
                      <th className="text-left pb-1 pr-2">Mfg</th>
                      <th className="text-left pb-1 pr-2">Exp</th>
                      <th className="text-right pb-1">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {request.contents_json.map((line, i) => (
                      <tr key={i} className="text-slate-700">
                        <td className="py-1 pr-2 font-semibold">{line.item_code}</td>
                        <td className="py-1 pr-2">{line.batch_no}</td>
                        <td className="py-1 pr-2">{line.mfg_date}</td>
                        <td className="py-1 pr-2">{line.exp_date}</td>
                        <td className="py-1 text-right">{line.qty_bottles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Quality gate warnings */}
          {missingExp && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-semibold">Cannot approve — Exp Date is missing.</p>
            </div>
          )}
          {isBigQty && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">Large qty ({request.qty_labels} labels &gt; 500). Approval requires confirmation.</p>
            </div>
          )}

          {/* Big qty confirm */}
          {confirmBig && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-800">Confirm approval of {request.qty_labels} labels?</p>
              <div className="flex gap-2">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={handleApprove} disabled={loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Approve'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmBig(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Reject input */}
          {showRejectInput && (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
                rows={3}
                placeholder="Reason for rejection (required)"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleReject}
                  disabled={!rejectNote.trim() || loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Reject'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRejectInput(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions — only for PENDING */}
        {request.status === 'PENDING' && !confirmBig && !showRejectInput && (
          <div className="border-t border-slate-200 px-5 py-4 flex gap-3 shrink-0">
            <Button
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleApprove}
              disabled={missingExp || loading}
            >
              <CheckCircle className="w-4 h-4" />
              {isBigQty ? 'Approve (large qty)' : 'Approve'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowRejectInput(true)}
              disabled={loading}
            >
              <XCircle className="w-4 h-4" /> Reject
            </Button>
          </div>
        )}

        {/* Already decided */}
        {request.status !== 'PENDING' && (
          <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500 text-center shrink-0">
            This request was <span className="font-semibold">{request.status}</span>
            {request.approved_by ? ` by ${request.approved_by}` : ''}.
            {request.decision_notes && <p className="text-xs mt-1 italic">{request.decision_notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, alert }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold text-slate-900' : 'text-slate-700'} ${alert ? 'text-red-600 font-bold' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}