import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';

function genRequestId() {
  return 'LPR-' + Date.now().toString(36).toUpperCase();
}

function genLogId() {
  return 'BPL-' + Date.now().toString(36).toUpperCase();
}

// Input style with min font-size 16px to prevent iOS zoom
const INPUT_CLS = "w-full h-12 px-3 text-base rounded-xl border border-slate-300 focus:border-cyan-500 focus:outline-none bg-white";

/**
 * Props:
 *   activeRun – PackingWO record (enriched with label_variant_id). Required for operators.
 *   user – current user
 *   products – all ProductMaster records (still used for trial pack content lines + shelf life lookup)
 *   isAdminOverride – if true (admin with no active run), show override reason + free product picker
 *   onSubmitted – callback after successful submit
 */
export default function BoxLabelForm({ activeRun, user, products, isAdminOverride, onSubmitted }) {
  // Locked fields from active run (or manual entry in admin override)
  const [itemCode, setItemCode] = useState('');
  const [productNameDisplay, setProductNameDisplay] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [qtyLabels, setQtyLabels] = useState(1);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin free-search state
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const batchRef = useRef(null);
  const qtyRef = useRef(null);
  const mfgRef = useRef(null);

  const product = products?.find(p => p.item_code === itemCode) || null;
  const isTrial = product?.is_trial_pack === true;

  // When activeRun changes, pre-fill fields from it
  useEffect(() => {
    if (!activeRun || isAdminOverride) return;
    // item_code: use product_code as item_code lookup key, fall back to label_sku_code
    const code = activeRun.product_code || activeRun.label_sku_code || '';
    setItemCode(code);
    setProductNameDisplay(activeRun.product || '');
    setBatchNo(activeRun.batch_id || activeRun.print_variables?.batch_code || '');
    // Pre-fill dates from print_variables if present
    if (activeRun.print_variables?.mfg) setMfgDate(activeRun.print_variables.mfg);
    if (activeRun.print_variables?.exp) setExpDate(activeRun.print_variables.exp);
  }, [activeRun, isAdminOverride]);

  // Auto-calc exp from shelf life (non-trial, non-override)
  useEffect(() => {
    if (isTrial || isAdminOverride) return;
    if (!mfgDate || !product?.shelf_life_days) return;
    const exp = format(addDays(parseISO(mfgDate), product.shelf_life_days), 'yyyy-MM-dd');
    setExpDate(exp);
  }, [mfgDate, product, isTrial, isAdminOverride]);

  const filteredProducts = (products || []).filter(p =>
    !search || [p.item_code, p.product_name, p.flavour].join(' ').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  async function handleSubmit() {
    if (!itemCode || !batchNo || !mfgDate || !expDate || qtyLabels < 1) return;
    if (isAdminOverride && !overrideReason.trim()) return;
    if (!activeRun && !isAdminOverride) return; // safety

    setSubmitting(true);
    const reqId = genRequestId();
    const logId = genLogId();
    const now = new Date().toISOString();

    const woId = activeRun?.wo_id || '';
    const labelVariantId = activeRun?.label_variant_id || '';
    const lineMachineId = activeRun?.assigned_line || '';

    // Create LabelPrintRequest
    await base44.entities.LabelPrintRequest.create({
      request_id: reqId,
      item_code: itemCode,
      product_name: productNameDisplay || itemCode,
      batch_no: batchNo,
      mfg_date: mfgDate,
      exp_date: expDate,
      qty_labels: Number(qtyLabels),
      is_trial_pack: isTrial,
      contents_json: [],
      status: 'PENDING',
      requested_by: user?.email || '',
      requested_at: now,
      wo_id: woId,
      product_code: activeRun?.product_code || '',
      label_variant_id: labelVariantId,
    });

    // Create BoxLabelPrintLog
    await base44.entities.BoxLabelPrintLog.create({
      log_id: logId,
      request_id: reqId,
      wo_id: woId,
      line_machine_id: lineMachineId,
      product_code: activeRun?.product_code || itemCode,
      batch_no: batchNo,
      label_variant_id: labelVariantId,
      qty_printed: Number(qtyLabels),
      print_type: isAdminOverride ? 'ADMIN_OVERRIDE' : 'PRODUCTION',
      override_reason: isAdminOverride ? overrideReason : '',
      printed_by: user?.email || '',
      printed_at: now,
    });

    // Alert
    await base44.entities.AlertEvent.create({
      severity: 'INFO',
      station_type: 'BOX_LABELS',
      message: `Label approval needed: ${reqId} (${qtyLabels} labels for ${itemCode}${woId ? ' / WO:' + woId : ''})`,
      reference_type: 'LabelPrintRequest',
      reference_id: reqId,
      status: 'OPEN',
    }).catch(() => {});

    // Reset
    setQtyLabels(1);
    setOverrideReason('');
    if (isAdminOverride) {
      setItemCode(''); setProductNameDisplay(''); setBatchNo(''); setMfgDate(''); setExpDate(''); setSearch('');
    }

    setSubmitting(false);
    onSubmitted?.();
  }

  const canSubmit = itemCode && batchNo && mfgDate && expDate && Number(qtyLabels) >= 1
    && (!isAdminOverride || overrideReason.trim())
    && (!!activeRun || isAdminOverride);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-800 text-base">New Label Print Request</h3>

      {/* Active run summary (locked) */}
      {activeRun && !isAdminOverride && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-3 py-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-xs font-semibold text-cyan-700 uppercase">Locked to Active Run</span>
            <span className="font-mono text-xs text-cyan-800">{activeRun.wo_id}</span>
          </div>
          <p className="font-semibold text-cyan-900">{activeRun.product}</p>
          {activeRun.product_code && <p className="text-xs font-mono text-cyan-700">{activeRun.product_code}</p>}
          {activeRun.label_variant_id && <p className="text-xs text-cyan-600">Label variant: {activeRun.label_variant_id}</p>}
        </div>
      )}

      {/* Admin override: free product search */}
      {isAdminOverride && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Admin Override — No Active Run</span>
          </div>
          {/* Product search */}
          <div className="relative">
            <input
              style={{ fontSize: '16px' }}
              className="w-full h-12 px-3 text-base rounded-xl border border-red-300 focus:border-red-500 focus:outline-none bg-white"
              placeholder="Search item code / product name..."
              value={product ? `${product.item_code} – ${product.product_name}${product.flavour ? ' · ' + product.flavour : ''}` : search}
              onChange={e => { setSearch(e.target.value); setItemCode(''); setProductNameDisplay(''); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {showDropdown && !itemCode && filteredProducts.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto mt-1">
                {filteredProducts.map(p => (
                  <button key={p.item_code} className="w-full text-left px-3 py-3 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0"
                    onMouseDown={() => { setItemCode(p.item_code); setProductNameDisplay(p.product_name + (p.flavour ? ` · ${p.flavour}` : '')); setSearch(''); setShowDropdown(false); }}>
                    <span className="font-semibold text-slate-800">{p.item_code}</span>
                    <span className="text-slate-500 ml-2">{p.product_name}{p.flavour ? ` · ${p.flavour}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Override reason */}
          <div>
            <label className="block text-xs font-semibold text-red-700 uppercase mb-1">Override Reason *</label>
            <input style={{ fontSize: '16px' }} className="w-full h-12 px-3 rounded-xl border border-red-300 focus:outline-none bg-white"
              placeholder="Enter reason for printing without active run…"
              value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          </div>
        </div>
      )}

      {/* Batch No */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Batch No</label>
        <input
          ref={batchRef}
          style={{ fontSize: '16px' }}
          className={INPUT_CLS}
          value={batchNo}
          onChange={e => setBatchNo(e.target.value)}
          placeholder="e.g. B-20240201"
          readOnly={!isAdminOverride && !!activeRun?.batch_id}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); qtyRef.current?.focus(); } }}
        />
      </div>

      {/* Qty Labels */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Qty Labels</label>
        <input
          ref={qtyRef}
          type="number"
          min={1}
          style={{ fontSize: '16px' }}
          className={INPUT_CLS}
          value={qtyLabels}
          onChange={e => setQtyLabels(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); mfgRef.current?.focus(); } }}
        />
      </div>

      {/* Mfg Date */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Mfg Date</label>
        <input
          ref={mfgRef}
          type="date"
          style={{ fontSize: '16px' }}
          className={INPUT_CLS}
          value={mfgDate}
          onChange={e => setMfgDate(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
        />
      </div>

      {/* Exp Date */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
          Exp Date {product?.shelf_life_days && !isTrial ? `(auto: mfg + ${product.shelf_life_days}d)` : ''}
        </label>
        <input
          type="date"
          style={{ fontSize: '16px' }}
          className={`${INPUT_CLS} ${(!isAdminOverride && product?.shelf_life_days) ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
          value={expDate}
          readOnly={!isAdminOverride && !!product?.shelf_life_days}
          onChange={e => setExpDate(e.target.value)}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || !canSubmit}
        className="w-full h-12 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-base"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Approval'}
      </Button>
    </div>
  );
}