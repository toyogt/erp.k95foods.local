import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';

function genRequestId() {
  return 'LPR-' + Date.now().toString(36).toUpperCase();
}

const emptyLine = () => ({ item_code: '', batch_no: '', mfg_date: '', exp_date: '', qty_bottles: '' });

export default function BoxLabelForm({ products, user, onSubmitted }) {
  const [itemCode, setItemCode] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [qtyLabels, setQtyLabels] = useState(1);
  const [isTrial, setIsTrial] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const product = products.find(p => p.item_code === itemCode) || null;

  // Auto-calc exp when mfg changes
  useEffect(() => {
    if (!mfgDate || !product?.shelf_life_days) return;
    const exp = format(addDays(parseISO(mfgDate), product.shelf_life_days), 'yyyy-MM-dd');
    setExpDate(exp);
  }, [mfgDate, product]);

  // Auto-calc trial pack outer exp = min expiry of lines
  useEffect(() => {
    if (!isTrial) return;
    const dates = lines.map(l => l.exp_date).filter(Boolean);
    if (!dates.length) return;
    const minExp = dates.sort()[0];
    setExpDate(minExp);
  }, [lines, isTrial]);

  const filteredProducts = products.filter(p =>
    !search || [p.item_code, p.product_name, p.flavour].join(' ').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  function updateLine(i, field, val) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }

  async function handleSubmit() {
    if (!itemCode || !batchNo || !mfgDate || !expDate || qtyLabels < 1) return;
    setSubmitting(true);
    const reqId = genRequestId();
    const now = new Date().toISOString();
    await base44.entities.LabelPrintRequest.create({
      request_id: reqId,
      item_code: itemCode,
      batch_no: batchNo,
      mfg_date: mfgDate,
      exp_date: expDate,
      qty_labels: Number(qtyLabels),
      is_trial_pack: isTrial,
      contents_json: isTrial ? lines.filter(l => l.item_code) : [],
      status: 'PENDING',
      requested_by: user?.email || '',
      requested_at: now,
    });
    // Create alert
    await base44.entities.AlertEvent.create({
      severity: 'INFO',
      station_type: 'BOX_LABELS',
      message: `Label approval needed: ${reqId} (${qtyLabels} labels for ${itemCode})`,
      reference_type: 'LabelPrintRequest',
      reference_id: reqId,
      status: 'OPEN',
    }).catch(() => {});
    // Reset
    setItemCode(''); setBatchNo(''); setMfgDate(''); setExpDate('');
    setQtyLabels(1); setIsTrial(false); setLines([emptyLine()]); setSearch('');
    setSubmitting(false);
    onSubmitted?.();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-800 text-base">New Label Print Request</h3>

      {/* Product search */}
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Product</label>
        <input
          className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none"
          placeholder="Search item code / product name..."
          value={product ? `${product.item_code} – ${product.product_name}${product.flavour ? ' · ' + product.flavour : ''}` : search}
          onChange={e => { setSearch(e.target.value); setItemCode(''); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
        />
        {showDropdown && !itemCode && filteredProducts.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto mt-1">
            {filteredProducts.map(p => (
              <button
                key={p.item_code}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                onMouseDown={() => { setItemCode(p.item_code); setSearch(''); setShowDropdown(false); }}
              >
                <span className="font-semibold text-slate-800">{p.item_code}</span>
                <span className="text-slate-500 ml-2">{p.product_name}{p.flavour ? ` · ${p.flavour}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product preview strip */}
      {product && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-3 py-2 flex flex-wrap gap-4 text-xs text-cyan-800">
          <span><b>Shelf life:</b> {product.shelf_life_days ?? '—'} days</span>
          <span><b>Bottles/Box:</b> {product.bottles_per_box ?? '—'}</span>
          <span><b>Vol:</b> {product.ml_per_bottle ?? '—'} ml</span>
          <span><b>MRP:</b> ₹{product.mrp_box ?? '—'}</span>
        </div>
      )}

      {/* Batch + dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Batch No</label>
          <input className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none"
            value={batchNo} onChange={e => setBatchNo(e.target.value)} placeholder="e.g. B-20240201" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Qty Labels</label>
          <input type="number" min={1} className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none"
            value={qtyLabels} onChange={e => setQtyLabels(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mfg Date</label>
          <input type="date" className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none"
            value={mfgDate} onChange={e => setMfgDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Exp Date{isTrial ? ' (auto=min)' : ''}</label>
          <input type="date" className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none"
            value={expDate}
            onChange={e => setExpDate(e.target.value)}
            readOnly={isTrial && user?.role !== 'admin'}
          />
        </div>
      </div>

      {/* Trial Pack toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsTrial(!isTrial)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isTrial ? 'bg-cyan-600' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isTrial ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-medium text-slate-700">Trial Pack</span>
      </div>

      {/* Trial pack content lines */}
      {isTrial && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase">Contents</p>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-center">
              <input className="h-9 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                placeholder="Item Code" value={line.item_code} onChange={e => updateLine(i, 'item_code', e.target.value)} />
              <input className="h-9 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                placeholder="Batch" value={line.batch_no} onChange={e => updateLine(i, 'batch_no', e.target.value)} />
              <input type="date" className="h-9 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                value={line.mfg_date} onChange={e => updateLine(i, 'mfg_date', e.target.value)} />
              <input type="date" className="h-9 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                value={line.exp_date} onChange={e => updateLine(i, 'exp_date', e.target.value)} />
              <div className="flex items-center gap-1">
                <input type="number" className="h-9 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none w-full"
                  placeholder="Qty bottles" value={line.qty_bottles} onChange={e => updateLine(i, 'qty_bottles', e.target.value)} />
                {lines.length > 1 && (
                  <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => setLines(prev => [...prev, emptyLine()])}
            className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 font-semibold mt-1">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !itemCode || !batchNo || !mfgDate || !expDate || qtyLabels < 1}
        className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-700"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Approval'}
      </Button>
    </div>
  );
}