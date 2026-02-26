import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';

function genRequestId() {
  return 'LPR-' + Date.now().toString(36).toUpperCase();
}

const emptyLine = () => ({ item_code: '', product_name: '', batch_no: '', mfg_date: '', exp_date: '', qty_bottles: '' });

export default function BoxLabelForm({ products, user, onSubmitted }) {
  const [itemCode, setItemCode] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [qtyLabels, setQtyLabels] = useState(1);
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Per-line search state
  const [lineSearch, setLineSearch] = useState([]);
  const [lineDropdown, setLineDropdown] = useState([]);

  const product = products.find(p => p.item_code === itemCode) || null;
  const isTrial = product?.is_trial_pack === true;

  // Auto-calc exp when mfg changes (non-trial)
  useEffect(() => {
    if (isTrial) return;
    if (!mfgDate || !product?.shelf_life_days) return;
    const exp = format(addDays(parseISO(mfgDate), product.shelf_life_days), 'yyyy-MM-dd');
    setExpDate(exp);
  }, [mfgDate, product]);

  // Auto-calc trial pack outer exp = min expiry of lines
  useEffect(() => {
    if (!isTrial) return;
    const dates = lines.map(l => l.exp_date).filter(Boolean);
    if (!dates.length) return;
    setExpDate(dates.sort()[0]);
  }, [lines, isTrial]);

  // Reset lines when trial status changes
  useEffect(() => {
    setLines([emptyLine()]);
    setLineSearch([]);
    setLineDropdown([]);
  }, [isTrial]);

  const filteredProducts = products.filter(p =>
    !search || [p.item_code, p.product_name, p.flavour].join(' ').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  function getLineFilteredProducts(idx) {
    const s = lineSearch[idx] || '';
    if (!s) return products.slice(0, 20);
    return products.filter(p =>
      [p.item_code, p.product_name, p.flavour].join(' ').toLowerCase().includes(s.toLowerCase())
    ).slice(0, 20);
  }

  function updateLine(i, field, val) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }

  function selectLineProduct(i, p) {
    setLines(prev => prev.map((l, idx) => idx === i
      ? { ...l, item_code: p.item_code, product_name: p.product_name + (p.flavour ? ` · ${p.flavour}` : '') }
      : l
    ));
    setLineSearch(prev => { const a = [...prev]; a[i] = ''; return a; });
    setLineDropdown(prev => { const a = [...prev]; a[i] = false; return a; });
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
    setQtyLabels(1); setLines([emptyLine()]); setSearch('');
    setLineSearch([]); setLineDropdown([]);
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
                {p.is_trial_pack && <span className="ml-2 text-xs font-bold text-purple-600">TRIAL</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product preview strip */}
      {product && (
        <div className={`border rounded-xl px-3 py-2 flex flex-wrap gap-4 text-xs ${isTrial ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-cyan-50 border-cyan-200 text-cyan-800'}`}>
          {isTrial && <span className="font-bold text-purple-700">⚗ Trial Pack — contents below</span>}
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
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Exp Date{isTrial ? ' (auto = min of contents)' : ''}</label>
          <input type="date" className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none"
            value={expDate}
            onChange={e => setExpDate(e.target.value)}
          />
        </div>
      </div>

      {/* Trial pack content lines — auto-shown if product is trial */}
      {isTrial && (
        <div className="bg-purple-50 rounded-xl p-3 space-y-3 border border-purple-200">
          <p className="text-xs font-bold text-purple-600 uppercase">Trial Pack Contents</p>
          {lines.map((line, i) => (
            <div key={i} className="bg-white rounded-lg border border-purple-100 p-2 space-y-2">
              {/* Product search for this line */}
              <div className="relative">
                <input
                  className="w-full h-8 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                  placeholder="Search product / item code…"
                  value={line.item_code ? `${line.item_code}${line.product_name ? ' – ' + line.product_name : ''}` : (lineSearch[i] || '')}
                  onChange={e => {
                    const s = [...(lineSearch)]; s[i] = e.target.value;
                    setLineSearch(s);
                    const d = [...(lineDropdown)]; d[i] = true;
                    setLineDropdown(d);
                    updateLine(i, 'item_code', '');
                    updateLine(i, 'product_name', '');
                  }}
                  onFocus={() => { const d = [...(lineDropdown)]; d[i] = true; setLineDropdown(d); }}
                />
                {lineDropdown[i] && !line.item_code && getLineFilteredProducts(i).length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-auto mt-0.5">
                    {getLineFilteredProducts(i).map(p => (
                      <button key={p.item_code} className="w-full text-left px-2 py-1.5 hover:bg-slate-50 text-xs"
                        onMouseDown={() => selectLineProduct(i, p)}>
                        <span className="font-semibold">{p.item_code}</span>
                        <span className="text-slate-500 ml-1">{p.product_name}{p.flavour ? ` · ${p.flavour}` : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Batch</div>
                  <input className="h-8 w-full px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                    placeholder="Batch No" value={line.batch_no} onChange={e => updateLine(i, 'batch_no', e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Mfg Date</div>
                  <input type="date" className="h-8 w-full px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                    value={line.mfg_date} onChange={e => updateLine(i, 'mfg_date', e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Exp Date</div>
                  <input type="date" className="h-8 w-full px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                    value={line.exp_date} onChange={e => updateLine(i, 'exp_date', e.target.value)} />
                </div>
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-0.5">Qty Bottles</div>
                    <input type="number" className="h-8 w-full px-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                      placeholder="Qty" value={line.qty_bottles} onChange={e => updateLine(i, 'qty_bottles', e.target.value)} />
                  </div>
                  {lines.length > 1 && (
                    <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 mb-0.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => setLines(prev => [...prev, emptyLine()])}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold mt-1">
            <Plus className="w-3.5 h-3.5" /> Add Bottle Line
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