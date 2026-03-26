/**
 * Connections panel — mirrors ERPNext "Connections" tab.
 * Shows all documents linked to a Sales Order, grouped by category.
 * Clicking a document navigates to its dedicated detail page.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Package, Truck, CreditCard, RotateCcw, ExternalLink } from 'lucide-react';

function DocLink({ label, count, href }) {
  if (!count) return (
    <span className="text-sm text-slate-400 cursor-default">{label}</span>
  );
  return (
    <a href={href}
      className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium">
      {label}
      <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}

export default function SOConnectionsPanel({ order }) {
  const soId = order?.id;

  const { data: picklists = [] } = useQuery({
    queryKey: ['pl_conn', soId],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: deliveryNotes = [] } = useQuery({
    queryKey: ['dn_conn', soId],
    queryFn: () => base44.entities.SalesDeliveryNote.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['si_conn', soId],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['pay_conn', soId],
    queryFn: () => base44.entities.SalesPayment.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: returns = [] } = useQuery({
    queryKey: ['ret_conn', soId],
    queryFn: () => base44.entities.SalesReturn.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const groups = [
    {
      label: 'Fulfillment',
      icon: Package,
      items: [
        { label: 'Pick List', count: picklists.length, href: picklists[0] ? `/SalesPicklistDetail?id=${picklists[0].id}` : null },
        { label: 'Delivery Note', count: deliveryNotes.length, href: deliveryNotes[0] ? `/SalesDeliveryNoteDetail?id=${deliveryNotes[0].id}` : null },
        { label: 'Sales Invoice', count: invoices.length, href: invoices[0] ? `/SalesInvoiceDetail?id=${invoices[0].id}` : null },
      ],
    },
    {
      label: 'Payment',
      icon: CreditCard,
      items: [
        { label: 'Payment Entry', count: payments.length, href: null },
      ],
    },
    {
      label: 'Returns',
      icon: RotateCcw,
      items: [
        { label: 'Sales Return', count: returns.length, href: null },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-3">
              <group.icon className="w-4 h-4 text-slate-500" />
              <h4 className="text-sm font-semibold text-slate-700">{group.label}</h4>
            </div>
            <div className="space-y-2">
              {group.items.map(item => (
                <div key={item.label}>
                  {item.href ? (
                    <DocLink label={item.label} count={item.count} href={item.href} />
                  ) : (
                    <span className={`text-sm ${item.count > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                      {item.label} {item.count > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full ml-1">{item.count}</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Inline doc summaries */}
      {picklists.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pick Lists</h4>
          <div className="space-y-2">
            {picklists.map(pl => (
              <a key={pl.id} href={`/SalesPicklistDetail?id=${pl.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-800">{pl.picklist_number}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    pl.status === 'pick_packed' ? 'bg-green-100 text-green-700' :
                    pl.status === 'dispatch_scheduled' ? 'bg-blue-100 text-blue-700' :
                    pl.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>{pl.status?.replace(/_/g, ' ')}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {deliveryNotes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Delivery Notes</h4>
          <div className="space-y-2">
            {deliveryNotes.map(dn => (
              <a key={dn.id} href={`/SalesDeliveryNoteDetail?id=${dn.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-800">{dn.dn_number}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    dn.workflow_state === 'bills_generated' ? 'bg-green-100 text-green-700' :
                    dn.workflow_state === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'
                  }`}>{dn.workflow_state?.replace(/_/g, ' ')}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sales Invoices</h4>
          <div className="space-y-2">
            {invoices.map(inv => (
              <a key={inv.id} href={`/SalesInvoiceDetail?id=${inv.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-800">{inv.invoice_number}</span>
                  {inv.total_amount && <span className="text-xs text-slate-500">₹{inv.total_amount.toLocaleString('en-IN')}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    inv.workflow_state === 'delivered' ? 'bg-green-100 text-green-700' :
                    inv.workflow_state === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>{inv.workflow_state?.replace(/_/g, ' ')}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}