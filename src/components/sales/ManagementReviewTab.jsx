import { ShieldAlert, AlertTriangle, Clock } from 'lucide-react';

const PLATFORM_COLORS = {
  swiggy: 'bg-orange-100 text-orange-700',
  zepto: 'bg-purple-100 text-purple-700',
  blinkit: 'bg-yellow-100 text-yellow-700',
  other: 'bg-slate-100 text-slate-600',
};

// Rule engine: collects all items needing management review
// Add new rules here as more modules are built
function buildReviewItems(grns, debitNotes, invoices) {
  const items = [];

  // Rule 1: GRN discrepancy > 1% of invoice amount
  for (const grn of grns) {
    const invoice = invoices.find(inv => inv.invoice_number === grn.invoice_number || inv.id === grn.invoice_id);
    const invoiceAmount = invoice?.total_amount || grn.invoice_total_amount || 0;
    const grnAmount = grn.grn_total_amount || 0;
    if (invoiceAmount > 0) {
      const pct = Math.abs((invoiceAmount - grnAmount) / invoiceAmount) * 100;
      if (pct > 1) {
        items.push({
          id: grn.id,
          type: 'grn_discrepancy',
          severity: pct > 5 ? 'high' : 'medium',
          source: 'GRN Reconciliation',
          reference: grn.grn_number,
          platform: grn.platform,
          description: `GRN amount (₹${grnAmount.toLocaleString('en-IN')}) differs from invoice (₹${invoiceAmount.toLocaleString('en-IN')}) by ${pct.toFixed(2)}%`,
          detail: `Invoice: ${grn.invoice_number} · PO: ${grn.po_number || '—'} · GRN Date: ${grn.grn_date || '—'}`,
          status: grn.status,
          amount_diff: Math.abs(invoiceAmount - grnAmount),
          raw: grn,
        });
      }
    }
  }

  // Rule 2: Debit notes under review or disputed
  for (const dn of debitNotes) {
    if (['under_review', 'disputed'].includes(dn.status)) {
      items.push({
        id: dn.id,
        type: 'debit_note_review',
        severity: dn.status === 'disputed' ? 'high' : 'medium',
        source: 'Debit Note',
        reference: dn.debit_note_number,
        platform: dn.platform,
        description: `Debit note of ₹${(dn.debit_note_amount || 0).toLocaleString('en-IN')} is ${dn.status === 'disputed' ? 'disputed' : 'under review'}`,
        detail: `Invoice: ${dn.invoice_number || '—'} · Narration: ${dn.narration || '—'}`,
        status: dn.status,
        amount_diff: dn.debit_note_amount || 0,
        raw: dn,
      });
    }
  }

  // Rule 3: GRNs pending match for too long (created > 7 days ago with no action)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  for (const grn of grns) {
    if (grn.status === 'pending_match' && grn.grn_date) {
      const grnDate = new Date(grn.grn_date);
      if (grnDate < sevenDaysAgo) {
        // Only add if not already added for discrepancy
        const alreadyAdded = items.some(i => i.id === grn.id && i.type === 'grn_discrepancy');
        if (!alreadyAdded) {
          items.push({
            id: grn.id + '_stale',
            type: 'grn_stale',
            severity: 'low',
            source: 'GRN Reconciliation',
            reference: grn.grn_number,
            platform: grn.platform,
            description: `GRN unmatched for more than 7 days`,
            detail: `Invoice: ${grn.invoice_number} · GRN Date: ${grn.grn_date}`,
            status: grn.status,
            amount_diff: null,
            raw: grn,
          });
        }
      }
    }
  }

  return items.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

const SEVERITY_STYLES = {
  high: { badge: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500', label: 'High' },
  medium: { badge: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500', label: 'Medium' },
  low: { badge: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400', label: 'Low' },
};

export default function ManagementReviewTab({ grns, debitNotes, invoices }) {
  const items = buildReviewItems(grns, debitNotes, invoices);

  const high = items.filter(i => i.severity === 'high').length;
  const medium = items.filter(i => i.severity === 'medium').length;
  const low = items.filter(i => i.severity === 'low').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'High Priority', count: high, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Medium Priority', count: medium, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Low Priority', count: low, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg p-4 text-center ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <ShieldAlert className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No items require management review</p>
          <p className="text-xs text-slate-400 mt-1">All GRNs, debit notes, and invoices are within acceptable thresholds.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-3 py-3">Source</th>
                <th className="text-left px-3 py-3">Reference</th>
                <th className="text-left px-3 py-3">Platform</th>
                <th className="text-left px-3 py-3">Issue</th>
                <th className="text-right px-3 py-3">Amount at Risk</th>
                <th className="text-left px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                const sev = SEVERITY_STYLES[item.severity];
                return (
                  <tr key={item.id} className={`hover:bg-slate-50 ${item.severity === 'high' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${sev.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-xs font-medium">{item.source}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{item.reference}</td>
                    <td className="px-3 py-3">
                      {item.platform && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[item.platform] || 'bg-slate-100 text-slate-600'}`}>
                          {item.platform.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-slate-800 font-medium leading-tight">{item.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-red-700">
                      {item.amount_diff != null ? `₹${item.amount_diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {item.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Review items are auto-generated by system rules: GRN discrepancy &gt;1%, disputed/under-review debit notes, and unmatched GRNs older than 7 days.
      </p>
    </div>
  );
}