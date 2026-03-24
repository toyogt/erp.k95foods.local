import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, XCircle, Package, ArrowRight, Clock } from 'lucide-react';

const STATUS_STYLE = {
  pending:   'bg-amber-100 text-amber-800',
  reviewing: 'bg-blue-100 text-blue-800',
  converted: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
};

export default function DistributorRequestsTab({ onSOCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [converting, setConverting] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['distributor_requests_all'],
    queryFn: () => base44.entities.DistributorRequest.list('-created_date', 100),
  });

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'reviewing');
  const doneRequests = requests.filter(r => r.status === 'converted' || r.status === 'rejected');

  async function convertToSO(req) {
    setConverting(req.id);

    // 1. Create Sales Order
    const soNumber = `SO-${Date.now().toString().slice(-8)}`;
    const so = await base44.entities.SalesOrder.create({
      so_number: soNumber,
      customer_name: req.distributor_name,
      status: 'draft',
      source: 'distributor_request',
      distributor_id: req.distributor_id || '',
      notes: req.notes || '',
      po_delivery_date: req.expected_delivery_date || null,
    });

    // 2. Create Sales Order Items from request items
    for (const item of (req.items || [])) {
      await base44.entities.SalesOrderItem.create({
        sales_order_id: so.id,
        so_number: soNumber,
        description: item.description,
        quantity: item.quantity,
        notes: item.notes || '',
        stock_status: 'not_checked',
      });
    }

    // 3. Audit log
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: so.id,
      reference_number: soNumber,
      action: 'created_from_distributor_request',
      new_value: `From: ${req.request_number} (${req.distributor_name})`,
      user_email: user?.email,
    });

    // 4. Mark request as converted
    await base44.entities.DistributorRequest.update(req.id, {
      status: 'converted',
      converted_so_id: so.id,
      converted_so_number: soNumber,
      reviewed_by: user?.email,
    });

    setConverting(null);
    toast({ title: 'Sales Order created', description: soNumber });
    refetch();
    qc.invalidateQueries(['sales_orders']);
    if (onSOCreated) onSOCreated();
  }

  async function rejectRequest(req) {
    if (!rejectReason.trim()) {
      toast({ title: 'Please enter a rejection reason', variant: 'destructive' });
      return;
    }
    await base44.entities.DistributorRequest.update(req.id, {
      status: 'rejected',
      rejection_reason: rejectReason.trim(),
      reviewed_by: user?.email,
    });
    setRejecting(null);
    setRejectReason('');
    toast({ title: 'Request rejected' });
    refetch();
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400 text-sm">Loading requests...</div>;

  return (
    <div className="space-y-5">
      {/* Pending section */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Awaiting Action
          {pendingRequests.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">{pendingRequests.length}</span>
          )}
        </h3>

        {pendingRequests.length === 0 ? (
          <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
            No pending requests — all caught up!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{req.request_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {req.distributor_name}
                      {req.contact_name && ` · ${req.contact_name}`}
                      {req.requested_by_email && <span className="text-slate-400"> · {req.requested_by_email}</span>}
                    </p>
                    {req.expected_delivery_date && (
                      <p className="text-xs text-slate-400 mt-0.5">Expected delivery: {req.expected_delivery_date}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(req.created_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Items */}
                <div className="flex flex-wrap gap-2">
                  {(req.items || []).map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg">
                      <Package className="w-3 h-3 flex-shrink-0" />
                      {item.description} × {item.quantity}
                    </span>
                  ))}
                </div>

                {req.notes && (
                  <p className="text-xs text-slate-500 italic bg-slate-50 rounded-lg px-3 py-2">"{req.notes}"</p>
                )}

                {/* Reject reason input */}
                {rejecting === req.id && (
                  <div className="flex gap-2 items-center">
                    <input
                      className="flex-1 h-8 text-sm rounded-md border border-input px-3"
                      placeholder="Reason for rejection..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      autoFocus
                    />
                    <Button variant="destructive" className="h-8 text-xs px-3" onClick={() => rejectRequest(req)}>Confirm</Button>
                    <button onClick={() => { setRejecting(null); setRejectReason(''); }} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    className="h-9 bg-slate-900 text-white text-sm flex-1 sm:flex-none sm:px-5"
                    onClick={() => convertToSO(req)}
                    disabled={converting === req.id}
                  >
                    {converting === req.id
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <ArrowRight className="w-4 h-4 mr-2" />}
                    Convert to Sales Order
                  </Button>
                  {rejecting !== req.id && (
                    <Button
                      variant="outline"
                      className="h-9 text-sm border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => { setRejecting(req.id); setRejectReason(''); }}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed section */}
      {doneRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Previously Processed</h3>
          <div className="space-y-2">
            {doneRequests.map(req => (
              <div key={req.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{req.request_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{req.distributor_name}</p>
                  {req.converted_so_number && (
                    <p className="text-xs text-green-600 font-medium mt-0.5">→ {req.converted_so_number}</p>
                  )}
                  {req.rejection_reason && (
                    <p className="text-xs text-red-500 mt-0.5">Reason: {req.rejection_reason}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(req.created_date).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}