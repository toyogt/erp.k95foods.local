import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Edit2, Check, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

// Compares extracted item rate vs system rate from SalesRateList
function RateDiff({ pdfRate, sysRate }) {
  if (!sysRate) return <span className="text-slate-400 text-xs">No system rate</span>;
  const diff = pdfRate - sysRate;
  const pct = sysRate > 0 ? ((diff / sysRate) * 100).toFixed(1) : 0;
  if (Math.abs(diff) < 0.01) return <span className="text-green-600 text-xs font-medium">✓ Match</span>;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {diff > 0 ? '+' : ''}{pct}% (sys ₹{sysRate?.toLocaleString('en-IN')})
    </span>
  );
}

export default function PDFInvoiceSplitView({ pdfEntry, priceList, onConfirm }) {
  const { pdfUrl, data, filename } = pdfEntry;
  const [sysRates, setSysRates] = useState({});
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(data?.items || []);

  useEffect(() => {
    if (!priceList || !data?.items?.length) return;
    base44.entities.SalesRateList.filter({ price_list: priceList, is_active: true })
      .then(rates => {
        const map = {};
        rates.forEach(r => { map[r.item_code] = r.rate; });
        setSysRates(map);
      });
  }, [priceList, data]);

  const hasMismatch = items.some(item => {
    const sys = sysRates[item.item_code];
    return sys && Math.abs((item.unit_base_cost || item.rate_snapshot || 0) - sys) > 0.01;
  });

  const taxable = data?.taxable_amount || items.reduce((s, i) => s + (i.taxable_value || 0), 0);
  const tax = data?.tax_amount || items.reduce((s, i) => s + (i.igst_amount || 0), 0);
  const total = data?.total_amount || (taxable + tax);

  return (
    <div className="flex h-full min-h-[480px] gap-0">
      {/* Left — PDF Preview */}
      <div className="w-1/2 border-r border-slate-200 overflow-auto bg-slate-50 flex flex-col">
        <div className="px-3 py-2 bg-white border-b border-slate-200 text-xs font-medium text-slate-600 truncate">
          📄 {filename}
        </div>
        <iframe
          src={pdfUrl}
          className="flex-1 w-full"
          style={{ minHeight: '440px' }}
          title={filename}
        />
      </div>

      {/* Right — Extracted Data */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Extracted Data</span>
            {hasMismatch && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                <AlertTriangle className="w-3 h-3" /> Rate mismatch
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1" onClick={() => setEditing(!editing)}>
              <Edit2 className="w-3 h-3" /> {editing ? 'Done' : 'Edit'}
            </Button>
            <Button size="sm" className="h-7 text-xs px-3 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onConfirm({ ...data, items, taxable_amount: taxable, tax_amount: tax, total_amount: total })}>
              <Check className="w-3 h-3" /> Confirm & Create SO
            </Button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-slate-600 font-medium">Description</th>
                <th className="px-2 py-2 text-right text-slate-600 font-medium w-10">Qty</th>
                <th className="px-2 py-2 text-right text-slate-600 font-medium w-16">Rate</th>
                <th className="px-2 py-2 text-right text-slate-600 font-medium w-16">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, i) => {
                const pdfRate = item.unit_base_cost || item.rate_snapshot || 0;
                const sysRate = sysRates[item.item_code];
                const mismatch = sysRate && Math.abs(pdfRate - sysRate) > 0.01;
                return (
                  <tr key={i} className={`hover:bg-slate-50 ${mismatch ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2 text-slate-700">
                      <div className="font-medium truncate max-w-[140px]" title={item.description}>{item.description}</div>
                      {item.item_code && <div className="text-slate-400 text-[10px] mt-0.5 truncate">{item.item_code}</div>}
                      {mismatch && <RateDiff pdfRate={pdfRate} sysRate={sysRate} />}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {editing ? (
                        <input type="number" className="w-12 border border-slate-200 rounded px-1 py-0.5 text-right text-xs"
                          value={item.quantity}
                          onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: +e.target.value } : it))} />
                      ) : item.quantity}
                    </td>
                    <td className={`px-2 py-2 text-right font-medium ${mismatch ? 'text-amber-700' : 'text-slate-700'}`}>
                      ₹{pdfRate.toLocaleString('en-IN')}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900">
                      ₹{(item.total_amount || item.taxable_value || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="border-t border-slate-200 bg-white divide-y divide-slate-100">
          <div className="flex justify-between px-4 py-2 text-xs text-slate-600">
            <span>Taxable</span><span className="font-medium text-slate-900">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between px-4 py-2 text-xs text-slate-600">
            <span>Tax (GST)</span><span className="font-medium text-slate-900">₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between px-4 py-2 text-sm font-semibold bg-slate-50">
            <span className="text-slate-900">Grand Total</span>
            <span className="text-emerald-700">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}