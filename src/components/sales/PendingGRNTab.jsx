import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, PackageCheck, Clock, FileText } from 'lucide-react';

const PLATFORM_COLORS = {
  blinkit: 'bg-yellow-100 text-yellow-700',
  swiggy: 'bg-orange-100 text-orange-700',
  zepto: 'bg-purple-100 text-purple-700',
  direct: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-600',
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function PendingGRNTab({ invoices, grns, orders, onRecordGRN }) {
  const [search, setSearch] = useState('');

  // Find delivered invoices that don't have a CustomerGRN yet
  const pendingInvoices = useMemo(() => {
    const grnInvoiceIds = new Set(grns.map(g => g.invoice_id).filter(Boolean));
    const grnInvoiceNumbers = new Set(grns.map(g => g.invoice_number?.trim().toLowerCase()).filter(Boolean));

    return invoices.filter(inv => {
      // Must be delivered
      if (inv.workflow_state !== 'delivered') return false;
      // Must not already have a GRN
      if (grnInvoiceIds.has(inv.id)) return false;
      if (inv.invoice_number && grnInvoiceNumbers.has(inv.invoice_number.trim().toLowerCase())) return false;
      return true;
    });
  }, [invoices, grns]);

  const filtered = useMemo(() => {
    if (!search) return pendingInvoices;
    const q = search.toLowerCase();
    return pendingInvoices.filter(inv =>
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      inv.so_number?.toLowerCase().includes(q)
    );
  }, [pendingInvoices, search]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          className="pl-9 h-10"
          placeholder="Search by invoice number, customer, sales order..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Clock className="w-4 h-4 text-amber-500" />
        <span><strong>{pendingInvoices.length}</strong> delivered invoice{pendingInvoices.length !== 1 ? 's' : ''} awaiting GRN</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-4 py-3">Invoice Number</th>
              <th className="text-left px-3 py-3">Sales Order</th>
              <th className="text-left px-3 py-3">Customer</th>
              <th className="text-left px-3 py-3">Platform</th>
              <th className="text-right px-3 py-3">Amount (INR)</th>
              <th className="text-left px-3 py-3">Invoice Date</th>
              <th className="text-left px-3 py-3">POD Date</th>
              <th className="text-center px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400">
                  <PackageCheck className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <p>All delivered invoices have GRNs recorded.</p>
                </td>
              </tr>
            )}
            {filtered.map(inv => {
              const so = orders.find(o => o.id === inv.sales_order_id);
              const platform = so?.platform || 'other';
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.invoice_number}</td>
                  <td className="px-3 py-3 text-slate-700">{inv.so_number || so?.so_number || '—'}</td>
                  <td className="px-3 py-3 text-slate-700">{inv.customer_name || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${PLATFORM_COLORS[platform] || PLATFORM_COLORS.other}`}>
                      {platform?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-800">
                    ₹{(inv.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs">{fmtDate(inv.invoice_date)}</td>
                  <td className="px-3 py-3 text-slate-500 text-xs">{fmtDate(inv.pod_date)}</td>
                  <td className="px-3 py-3 text-center">
                    <Button
                      size="sm"
                      className="h-9 text-sm gap-1"
                      onClick={() => onRecordGRN(inv, so)}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Record GRN
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}