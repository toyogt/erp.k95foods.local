import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Edit2, Check, AlertTriangle, TrendingUp, TrendingDown, User, Tag, Ban, Calendar, FileText, Loader2, CheckCircle2 } from 'lucide-react';

// Map platform to ProductMaster field for platform-specific ID
const PLATFORM_ID_FIELD = {
  zepto: 'zepto_item_id',
  swiggy: 'swiggy_item_id',
  blinkit: 'bigbasket_item_id',
};
const PLATFORM_LABEL = {
  zepto: 'Zepto ID',
  swiggy: 'Swiggy ID',
  blinkit: 'BigBasket ID',
};

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

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr;
}

export default function PDFInvoiceSplitView({ pdfEntry, onConfirm }) {
  const { pdfUrl, data, filename } = pdfEntry;

  const [customer, setCustomer] = useState(null);        // Customer entity record
  const [sysRates, setSysRates] = useState({});           // item_code → system rate
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState([]);
  const [mismatchRemarks, setMismatchRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync items from pdfEntry whenever the entry changes
  useEffect(() => {
    setItems(data?.items || []);
    setEditing(false);
    setMismatchRemarks('');
  }, [pdfEntry.id]);

  // Resolve customer → price list (skip if already resolved server-side)
  useEffect(() => {
    if (!data?.customer_name) return;
    if (data?._customer_id) {
      // Already resolved on the server — skip extra API call
      setCustomer({ id: data._customer_id, price_list: data._customer_price_list, customer_group: data._customer_group, name: data.customer_name });
      return;
    }
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

  const priceList = customer?.price_list || data?.price_list || '';

  // Fetch ProductMaster for platform IDs, EAN, SKU code
  const { data: products = [] } = useQuery({
    queryKey: ['product_master_pdf_view', pdfEntry.id],
    queryFn: () => base44.entities.ProductMaster.filter({}),
    staleTime: 300000,
  });
  const productMap = {};
  products.forEach(p => { if (p.item_code) productMap[p.item_code] = p; });

  // Resolve effective platform (Scootsy = Swiggy/Instamart)
  const effectivePlatform = (data?.customer_name || '').toLowerCase().includes('scootsy') ? 'swiggy' : data?.platform;
  const platformField = PLATFORM_ID_FIELD[effectivePlatform];
  const platformLabel = PLATFORM_LABEL[effectivePlatform];

  const hasMismatch = items.some(item => {
    const pdfRate = item._pdf_rate;
    const sys = sysRates[item.item_code];
    return pdfRate && sys && Math.abs(pdfRate - sys) > 0.01;
  });

  // Block SO creation if no price list found and no rates matched
  const noRateBlocked = !!(data?._no_rate || (!priceList && items.length > 0 && items.every(i => !i._rate_matched)));

  // System taxable = sum of (system rate × qty) for each item
  const systemTaxable = items.reduce((s, i) => s + ((i.unit_base_cost || 0) * (i.quantity || 0)), 0);

  // PDF-extracted footer totals (authoritative from the PO document)
  const pdfTaxable = data?.taxable_amount || 0;
  const pdfTax = data?.tax_amount || 0;
  const pdfTotal = data?.total_amount || 0;

  // Display values: always use PDF totals for tax & grand total;
  // taxable shows system-computed (from system rates)
  const taxable = systemTaxable;
  const tax = pdfTax > 0 ? pdfTax : 0;
  const total = taxable + tax;

  // Mismatch: compare system taxable vs PDF taxable (rate differences)
  const taxableGap = pdfTaxable > 0 ? Math.abs(systemTaxable - pdfTaxable) : 0;
  const hasTotalGap = taxableGap > 0.50;

  // No-rate block screen
  if (noRateBlocked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Ban className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-red-700 mb-1">Cannot Create Sales Order</h3>
          <p className="text-sm text-slate-600 max-w-sm">
            <strong>{data?.customer_name || 'This customer'}</strong> does not have a Price List assigned — and no matching rates were found in any price list.
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Please assign a Price List to this customer in Customer Master, or add rates to the Sales Rate List before processing this order.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/SalesCustomerManager" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-9 text-sm">Open Customer Master</Button>
          </a>
          <a href="/SalesPriceListView" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-9 text-sm">Open Price List</Button>
          </a>
        </div>
      </div>
    );
  }

  async function handleConfirmClick() {
    setSubmitting(true);
    setEditing(false);
    await onConfirm({
      ...data,
      items,
      price_list: priceList,
      taxable_amount: taxable,
      tax_amount: tax,
      total_amount: total,
      ...(hasTotalGap ? { mismatch_remarks: mismatchRemarks.trim(), mismatch_gap: taxableGap } : {}),
    });
    // submitting stays true — parent will switch to confirmed state
  }

  return (
    <div className="flex h-full min-h-[480px] gap-0 relative">

      {/* Submitting overlay */}
      {submitting && (
        <div className="absolute inset-0 z-30 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
            <CheckCircle2 className="w-6 h-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Creating Sales Order...</p>
            <p className="text-xs text-slate-500 mt-1">Saving items, linking documents and logging audit trail</p>
          </div>
        </div>
      )}

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

        {/* Customer + Price List + Address Info */}
        <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <User className="w-3.5 h-3.5" />
            <span className="font-medium text-slate-900">{data?.customer_name || <span className="text-slate-400 italic">Customer not detected</span>}</span>
            {priceList && <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{priceList}</span>}
            {!priceList && customer && <span className="text-amber-600 text-[10px]">No price list assigned</span>}
          </div>
          {data?.shipping_address && (
            <div className="text-slate-500 text-[11px] leading-relaxed pl-[22px]">
              📍 {data.shipping_address}
            </div>
          )}
          {/* Purchase Order Metadata */}
          {(data?.po_number || data?.po_date || data?.po_release_date || data?.po_delivery_date || data?.po_expiry_date || data?.payment_terms) && (
            <div className="bg-white border border-slate-200 rounded-lg p-2 mt-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-700 text-[11px]">Purchase Order Details</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {data.po_number && <div><span className="text-slate-500">PO No:</span> <span className="font-medium text-slate-800">{data.po_number}</span></div>}
                {data.po_date && <div><span className="text-slate-500">PO Date:</span> <span className="font-medium text-slate-800">{formatDisplayDate(data.po_date)}</span></div>}
                {data.po_release_date && <div><span className="text-slate-500">Release Date:</span> <span className="font-medium text-slate-800">{formatDisplayDate(data.po_release_date)}</span></div>}
                {data.payment_terms && <div><span className="text-slate-500">Payment Terms:</span> <span className="font-medium text-slate-800">{data.payment_terms}</span></div>}
                {data.po_delivery_date && <div><span className="text-slate-500">Expected Delivery:</span> <span className="font-medium text-slate-800">{formatDisplayDate(data.po_delivery_date)}</span></div>}
                {data.po_expiry_date && <div><span className="text-slate-500">PO Expiry:</span> <span className="font-medium text-slate-800">{formatDisplayDate(data.po_expiry_date)}</span></div>}
              </div>
            </div>
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
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1" disabled={submitting} onClick={() => setEditing(!editing)}>
              <Edit2 className="w-3 h-3" /> {editing ? 'Done' : 'Edit'}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs px-3 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={submitting || (hasTotalGap && !mismatchRemarks.trim())}
              title={hasTotalGap && !mismatchRemarks.trim() ? 'Please add mismatch remarks before confirming' : ''}
              onClick={handleConfirmClick}
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {submitting ? 'Submitting...' : 'Confirm & Create SO'}
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
                      <div className="font-medium leading-snug" title={item._product_name || item.description}>{item._product_name || item.description}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {item.sku_code && <span className="text-[10px] text-slate-500">SKU: <span className="font-mono text-slate-700">{item.sku_code}</span></span>}
                        {(item.ean_number || productMap[item.item_code]?.product_barcode) && (
                          <span className="text-[10px] text-slate-500">EAN: <span className="font-mono text-slate-700">{item.ean_number || productMap[item.item_code]?.product_barcode}</span></span>
                        )}
                        {platformField && productMap[item.item_code]?.[platformField] && (
                          <span className="text-[10px] text-blue-600 font-medium">{platformLabel}: <span className="font-mono">{productMap[item.item_code][platformField]}</span></span>
                        )}
                      </div>
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
        <div className={`border-t bg-white divide-y divide-slate-100 flex-shrink-0 ${hasTotalGap ? 'border-t-2 border-red-400' : 'border-slate-200'}`}>
          {hasTotalGap && (
            <div className="px-4 py-2 bg-red-50 space-y-2">
              <div className="flex items-center gap-2 text-red-700 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Taxable mismatch — PDF: ₹{pdfTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} vs System: ₹{systemTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Gap: ₹{taxableGap.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
              </div>
              <textarea
                className="w-full border border-red-300 rounded-md px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white resize-none"
                rows={2}
                placeholder="Mismatch remarks required before confirming..."
                value={mismatchRemarks}
                onChange={e => setMismatchRemarks(e.target.value)}
              />
            </div>
          )}
          <div className="flex justify-between px-4 py-2 text-xs text-slate-600">
            <span>Taxable (System Rates)</span>
            <span className="font-medium text-slate-900">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {pdfTaxable > 0 && Math.abs(systemTaxable - pdfTaxable) > 0.50 && (
            <div className="flex justify-between px-4 py-1 text-[11px] text-amber-600 bg-amber-50/50">
              <span>Taxable (PDF)</span>
              <span className="font-medium">₹{pdfTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2 text-xs text-slate-600">
            <span>Tax (GST) — from PDF</span>
            <span className="font-medium text-slate-900">₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={`flex justify-between px-4 py-2 text-sm font-semibold ${hasTotalGap ? 'bg-red-50' : 'bg-slate-50'}`}>
            <span className="text-slate-900">Grand Total</span>
            <span className={hasTotalGap ? 'text-red-700' : 'text-emerald-700'}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}