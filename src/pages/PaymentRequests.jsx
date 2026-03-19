import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Plus, CheckCircle2, X, Loader2 } from 'lucide-react';
import { genId, logAccountsAudit, INVOICE_STATUS_COLOR, PAYMENT_STATUS_COLOR } from '@/components/accounts/accountsHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';

export default function PaymentRequests() {
  const [user, setUser] = useState(null);
  const [payReqs, setPayReqs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedInv, setSelectedInv] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [approval, setApproval] = useState({});
  const [approving, setApproving] = useState({});

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [payReqsData, invData] = await Promise.all([
        base44.entities.PaymentRequest.list(),
        base44.entities.SupplierInvoice.filter({ status: 'MATCHED_OK' }),
      ]);
      setPayReqs(payReqsData);
      setInvoices(invData);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedInv || !amount) {
      setError('Select invoice and amount');
      return;
    }
    setSubmitting(true);
    try {
      const inv = invoices.find(i => i.id === selectedInv);
      const payId = genId('PAY');
      const payReqRecord = await base44.entities.PaymentRequest.create({
        payreq_id: payId,
        inv_id: inv.inv_id,
        supplier_id: inv.supplier_id,
        supplier_name: inv.supplier_name,
        requested_amount: parseFloat(amount),
        status: 'DRAFT',
        requested_by: user?.full_name || user?.email || '',
        notes,
      });

      await logAccountsAudit({
        action: 'PAYMENT_REQUEST_CREATED',
        entity_type: 'PaymentRequest',
        entity_id: payId,
        details: { inv_id: inv.inv_id },
        user,
      });

      // FMS: fire payment_request_created using invoice.id (in chain), then link payment req
      await fireFMSEvent('payment_request_created', inv.id);
      const instances = await findFMSInstanceByRef(inv.id);
      for (const inst of instances) {
        await linkFMSRef(inst.id, payReqRecord.id);
      }

      setShowNew(false);
      setSelectedInv('');
      setAmount('');
      setNotes('');
      loadData();
    } catch (err) {
      setError(`Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (payReqId) => {
    setApproving(prev => ({ ...prev, [payReqId]: true }));
    try {
      const payReq = payReqs.find(p => p.payreq_id === payReqId);
      await base44.entities.PaymentRequest.update(payReq.id, {
        status: 'APPROVED',
        approved_by: user?.full_name || user?.email || '',
        approved_at: new Date().toISOString(),
      });

      // Update invoice status
      const inv = invoices.find(i => i.inv_id === payReq.inv_id);
      if (inv) {
        await base44.entities.SupplierInvoice.update(inv.id, {
          status: 'APPROVED_FOR_PAYMENT',
        });
      }

      await logAccountsAudit({
        action: 'PAYMENT_REQUEST_APPROVED',
        entity_type: 'PaymentRequest',
        entity_id: payReqId,
        user,
      });

      loadData();
    } catch (err) {
      setError(`Approval failed: ${err.message}`);
    } finally {
      setApproving(prev => ({ ...prev, [payReqId]: false }));
    }
  };

  const handleReject = async (payReqId) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    try {
      const payReq = payReqs.find(p => p.payreq_id === payReqId);
      await base44.entities.PaymentRequest.update(payReq.id, {
        status: 'REJECTED',
        rejection_reason: reason,
      });

      await logAccountsAudit({
        action: 'PAYMENT_REQUEST_REJECTED',
        entity_type: 'PaymentRequest',
        entity_id: payReqId,
        user,
      });

      loadData();
    } catch (err) {
      setError(`Rejection failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Payment Requests</h2>
        <Button onClick={() => setShowNew(!showNew)} className="gap-2">
          <Plus className="w-4 h-4" /> New Request
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* New Request Form */}
      {showNew && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-slate-900 mb-4">Create Payment Request</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice (MATCHED_OK only)</label>
              <select
                value={selectedInv}
                onChange={e => setSelectedInv(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select invoice...</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.inv_id} ({inv.supplier_name}) - ₹{inv.invoice_amount}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowNew(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={submitting || !selectedInv}
                className="flex-1 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Payment Requests Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : payReqs.length === 0 ? (
        <Card className="p-12 text-center text-slate-500">
          No payment requests yet
        </Card>
      ) : (
        <div className="space-y-3">
          {payReqs.map(payReq => (
            <Card key={payReq.id} className="p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{payReq.payreq_id}</div>
                  <div className="text-sm text-slate-600">{payReq.supplier_name} • ₹{payReq.requested_amount}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLOR[payReq.status]}`}>
                  {payReq.status}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 text-xs text-slate-600 mb-4">
                <div><span className="font-medium">Invoice:</span> {payReq.inv_id}</div>
                <div><span className="font-medium">Requested:</span> {payReq.requested_by}</div>
                <div><span className="font-medium">Approved:</span> {payReq.approved_by || '—'}</div>
              </div>

              {payReq.notes && (
                <div className="mb-3 p-2 bg-slate-50 rounded text-xs text-slate-700">
                  {payReq.notes}
                </div>
              )}

              {/* Approval Actions */}
              {payReq.status === 'DRAFT' && user?.role === 'admin' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(payReq.payreq_id)}
                    disabled={approving[payReq.payreq_id]}
                    size="sm"
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {approving[payReq.payreq_id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleReject(payReq.payreq_id)}
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-2"
                  >
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}

              {payReq.status === 'REJECTED' && (
                <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                  <span className="font-medium">Rejection:</span> {payReq.rejection_reason}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}