export default function SOItemsTable({ items, order }) {
  if (!items || !items.length) return (
    <div className="text-center py-8 text-slate-400 text-sm">No items added to this order.</div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
            <th className="px-3 py-2 text-left">Item Code</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left">HSN</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">MRP</th>
            <th className="px-3 py-2 text-right">Base Cost</th>
            <th className="px-3 py-2 text-right">IGST %</th>
            <th className="px-3 py-2 text-right">Total (INR)</th>
            <th className="px-3 py-2 text-center">Stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-600 font-mono text-xs">{item.item_code || '—'}</td>
              <td className="px-3 py-2 text-slate-800">{item.description}</td>
              <td className="px-3 py-2 text-slate-500 text-xs">{item.hsn_code || '—'}</td>
              <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
              <td className="px-3 py-2 text-right">₹{item.mrp || '—'}</td>
              <td className="px-3 py-2 text-right">₹{item.unit_base_cost || '—'}</td>
              <td className="px-3 py-2 text-right">{item.igst_rate ?? '—'}%</td>
              <td className="px-3 py-2 text-right font-medium">
                {item.total_amount ? `₹${item.total_amount.toLocaleString('en-IN')}` : '—'}
              </td>
              <td className="px-3 py-2 text-center">
                <StockBadge status={item.stock_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <div className="text-sm font-semibold text-slate-900">
          Grand Total: ₹{order?.total_amount?.toLocaleString('en-IN') || items.reduce((s, i) => s + (i.total_amount || 0), 0).toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}

function StockBadge({ status }) {
  const map = {
    full:        'bg-green-100 text-green-700',
    partial:     'bg-amber-100 text-amber-700',
    unavailable: 'bg-red-100 text-red-600',
    not_checked: 'bg-slate-100 text-slate-500',
  };
  const labels = { full: 'Full', partial: 'Partial', unavailable: 'None', not_checked: 'Not Checked' };
  if (!status) return null;
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${map[status] || map.not_checked}`}>{labels[status] || status}</span>;
}