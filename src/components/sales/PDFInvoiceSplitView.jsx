import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Edit2, Check, AlertTriangle, TrendingUp, TrendingDown, User, Tag } from 'lucide-react';

// Shows diff between system rate and PDF rate
function RateDiff({ pdfRate, sysRate }) {
  if (!sysRate) return null;
  const diff = pdfRate - sysRate;
  if (Math.abs(diff) < 0.01) return null;
  const pct = sysRate > 0 ? ((diff / sysRate) * 100).toFixed(1) : 0;
  return (
    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      PDF ₹{pdfRate} ({diff > 0 ? '+' : ''}{pct}%)
    </span>
  );
}

export default function PDFInvoiceSplitView({ pdfEntry, onConfirm }) {
  const { pdfUrl, data, filename } = pdfEntry;

  const [customer, setCustomer] = useState(null);        // Customer entity record
  const [sysRates, setSysRates] = useState({});           // item_code → system rate
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState([]);

  // Sync items from pdfEntry whenever the entry changes
  useEffect(() => {
    setItems(data?.items || []);
    setEditing(false);
  }, [pdfEntry.id]);

  // Resolve customer → price list
  useEffect(() => {
    if (!data?.customer_name) return;
    base44.entities.Customer.filter({ name: data.customer_name }, undefined, 1)
      .then(results => {
        if (results?.[0]) setCustomer(results[0]);
      });
  }, [data?.customer_name, pdfEntry.id]);

  // Fetch system rates based on customer's price list
  useEffect(() => {
    const priceList = customer?.price_list || data?.price_list;
    if (!priceList || !data?.items?.length) return;

    base44.entities.SalesRateList.filter({ price_list: priceList, is_active: true })
      .then(rates => {
        const map = {};
        rates.forEach(r => { map[r.item_code] = r.rate; });
        setSysRates(map);
        // Auto-fill items with system rate where available
        setItems(prev => prev.map(item => ({
          ...item,
          unit_base_cost: map[item.item_code] ?? item.unit_base_cost ?? item.rate_snapshot ?? 0,
          _pdf_rate: item.unit_base_cost ?? item.rate_snapshot ?? 0,
        })));
      });
  }, [customer, data?.price_list, pdfEntry.id]);

  const hasMismatch = items.some(item => {
    const pdfRate = item._pdf_rate;
    const sys = sysRates[item.item_code];
    return pdfRate && sys && Math.abs(pdfRate - sys) > 0.01;
  });

  const taxable = items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost * i.quantity) || 0), 0);
  const tax = items.reduce((s, i) => s + (i.igst_amount || (taxable * 0.12) || 0), 0);
  const total = taxable + tax;

  const priceList = customer?.price_list || data?.price_list || '';

  return (
    <div className="flex h-full min-h-[480px] gap-0">
      {/* Left — PDF Preview */}
      <div className="w-1/2 border-r border-slate-200 overflow-auto bg-slate-50 flex flex-col">
        <div className="px-3 py-2 bg-white border-b border-slate-200 text-xs font-medium text-slate-600 truncate flex items-center gap-1.5">
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

        {/* Customer + Price List Info */}
        <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center gap-4 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-slate-600">
            <User className="w-3 h-3" />
            <span className="font-medium text-slate-900">{data?.customer_name || <span className="text-slate-400 italic">Customer not detected</span>}</span>
          </span>
          {priceList && (
            <span className="flex items-center gap-1 text-slate-600">
              <Tag className="w-3 h-3" />
              <span className="font-medium text-emerald-700">{priceList}</span>
            </span>
          )}
          {!priceList && customer && (
            <span className="text-amber-600 text-[10px]">No price list assigned to this customer</span>
          )}
        </div>

        {/* Header */}
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
            <Button
              size="sm"
              className="h-7 text-xs px-3 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onConfirm({
                ...data,
                items,
                price_list: priceList,
                taxable_amount: taxable,
                tax_amount: tax,
                total_amount: total,
              })}
            >
              <Check className="w-3 h-3" /> Confirm &amp; Create SO
            </Button>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-slate-600 font-medium">Description</th>
                <th className="px-2 py-2 text-right text-slate-600 font-medium w-10">Qty</th>
                <th className="px-2 py-2 text-right text-slate-600 font-medium w-20">System Rate</th>
                <th className="px-2 py-2 text-right text-slate-600 font-medium w-16">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, i) => {
                const sysRate = item.unit_base_cost || 0;
                const pdfRate = item._pdf_rate || 0;
                const mismatch = pdfRate && Math.abs(pdfRate - sysRate) > 0.01;
                const lineTotal = (sysRate * (item.quantity || 0));
                return (
                  <tr key={i} className={`hover:bg-slate-50 ${mismatch ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-3 py-2 text-slate-700">
                      <div className="font-medium truncate max-w-[140px]" title={item.description}>{item.description}</div>
                      {item.item_code && <div className="text-slate-400 text-[10px] mt-0.5">{item.item_code}</div>}
                      <RateDiff pdfRate={pdfRate} sysRate={sysRate} />
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {editing ? (
                        <input
                          type="number"
                          className="w-12 border border-slate-200 rounded px-1 py-0.5 text-right text-xs"
                          value={item.quantity}
                          onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: +e.target.value } : it))}
                        />
                      ) : item.quantity}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900">
                      {editing ? (
                        <input
                          type="number"
                          className="w-16 border border-slate-200 rounded px-1 py-0.5 text-right text-xs"
                          value={sysRate}
                          onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_base_cost: +e.target.value } : it))}
                        />
                      ) : (
                        <span className={mismatch ? 'text-emerald-700' : ''}>₹{sysRate.toLocaleString('en-IN')}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900">
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No items extracted</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="border-t border-slate-200 bg-white divide-y divide-slate-100 flex-shrink-0">
          <div className="flex justify-between px-4 py-2 text-xs text-slate-600">
            <span>Taxable</span>
            <span className="font-medium text-slate-900">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between px-4 py-2 text-xs text-slate-600">
            <span>Tax (GST)</span>
            <span className="font-medium text-slate-900">₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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