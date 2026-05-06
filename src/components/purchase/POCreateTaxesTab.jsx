import { formatINR } from './purchaseHelpers';

export default function POCreateTaxesTab({ items, setItems, form, setForm }) {
  const subtotal = items.reduce((s, r) => s + (r.rate || 0) * (r.qty || 0), 0);

  function updateItemGST(idx, val) {
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, gst_percent: Number(val) || 0 } : r));
  }

  function updateField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  const totalGST = items.reduce((s, r) => {
    const amt = (r.rate || 0) * (r.qty || 0);
    return s + amt * ((r.gst_percent || 0) / 100);
  }, 0);
  const freight = Number(form.estimated_freight || 0);

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Per-item GST */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Item-wise GST</h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs text-slate-700">
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-right px-3 py-2 w-24">GST %</th>
                <th className="text-right px-3 py-2">GST Amount</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, idx) => {
                const amt = (row.rate || 0) * (row.qty || 0);
                const gst = amt * ((row.gst_percent || 0) / 100);
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{row.item_name || row.item_code || `Item ${idx + 1}`}</td>
                    <td className="px-3 py-2 text-right">{formatINR(amt)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-full h-8 border border-slate-200 rounded-lg px-2 text-sm text-right"
                        value={row.gst_percent || ''}
                        onChange={e => updateItemGST(idx, e.target.value)}
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm">{formatINR(gst)}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatINR(amt + gst)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Freight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Estimated Freight (₹)</label>
          <input
            type="number"
            className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1"
            value={form.estimated_freight || ''}
            onChange={e => updateField('estimated_freight', e.target.value)}
            placeholder="0.00"
            min={0}
          />
        </div>
      </div>

      {/* Grand Total */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-medium">{formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total GST</span>
          <span className="font-medium">{formatINR(totalGST)}</span>
        </div>
        {freight > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Freight</span>
            <span className="font-medium">{formatINR(freight)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
          <span>Grand Total</span>
          <span>{formatINR(subtotal + totalGST + freight)}</span>
        </div>
      </div>
    </div>
  );
}