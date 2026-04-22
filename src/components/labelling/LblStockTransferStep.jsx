import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { generateBatchNumber, BATCH_SCHEMES } from '@/lib/batchNumberGenerator';
import { Loader2, Package, RefreshCw, Info } from 'lucide-react';
import LblLabelPreviewCard from '@/components/labelling/LblLabelPreviewCard';
import LblBoxLabelPrintButton from '@/components/labelling/LblBoxLabelPrintButton';
import moment from 'moment';

export default function LblStockTransferStep({ job, user, onComplete }) {
  // Transfer quantity is frozen to the planned quantity from the shift plan
  const [qty] = useState(job?.quantity_bottles_planned || '');
  // Start empty — the useEffect below will auto-generate from product config + MFG date.
  // job.batch_no is intentionally NOT used as initial value to avoid stale/wrong batch carryover.
  const [batchNo, setBatchNo] = useState('');
  const [batchSeq, setBatchSeq] = useState(1);
  // Labelling date is always today — read-only
  const [labellingDate] = useState(moment().format('YYYY-MM-DD'));
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Load ProductMaster to get batch generation config
  const { data: productList = [] } = useQuery({
    queryKey: ['product-master-for-batch', job?.sku_code],
    queryFn: () => base44.entities.ProductMaster.filter({ item_code: job?.sku_code }),
    enabled: !!job?.sku_code,
  });
  const product = productList[0];

  const mfgDate = job?.manufacturing_date || ''; // already DD/MM/YYYY
  const schemeInfo = BATCH_SCHEMES.find(s => s.value === (product?.batch_scheme || 'excel_date'));
  const canAutogenerate = !!(product?.product_prefix_code && product?.flavour_code && mfgDate);

  // Auto-generate batch number whenever product config or sequence changes.
  // Always regenerate from formula — do NOT fall back to job.batch_no,
  // which may be stale or incorrect from a previous run.
  useEffect(() => {
    if (!canAutogenerate) return;
    const generated = generateBatchNumber(product, mfgDate, batchSeq);
    if (generated) setBatchNo(generated);
  }, [product, batchSeq, mfgDate, canAutogenerate]);

  const handleRegenerate = () => {
    if (!canAutogenerate) {
      toast({ title: 'Cannot Generate', description: 'Product is missing Prefix Code or Flavour Code in Product Master.', variant: 'destructive' });
      return;
    }
    const generated = generateBatchNumber(product, mfgDate, batchSeq);
    setBatchNo(generated);
  };

  const handleSubmit = async () => {
    if (!qty || Number(qty) <= 0) {
      toast({ title: 'Invalid Quantity', description: 'Enter a valid transfer quantity', variant: 'destructive' });
      return;
    }
    if (!labellingDate) {
      toast({ title: 'Labelling Date Required', description: 'Select the labelling start date', variant: 'destructive' });
      return;
    }
    if (!batchNo.trim()) {
      toast({ title: 'Batch Number Required', description: 'Generate or enter a batch number', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const labellingDateFormatted = moment(labellingDate).format('DD/MM/YYYY');
    await base44.entities.LabellingJob.update(job.id, {
      status: 'stock_transferred',
      stock_transfer_qty: Number(qty),
      stock_transfer_remarks: remarks,
      labelling_date: labellingDateFormatted,
      batch_no: batchNo.trim(),
      batch_seq: Number(batchSeq) || 1,
    });
    await logLabellingEvent({
      action_type: 'stock_transferred',
      job_id: job.id,
      plan_id: job.plan_id,
      description: `Transferred ${qty} bottles for job ${job.job_id} — Batch: ${batchNo} — Labelling Date: ${labellingDateFormatted}`,
      details_json: { qty: Number(qty), batch_no: batchNo, labelling_date: labellingDateFormatted, remarks },
      user,
    });
    toast({ title: 'Stock Transfer Recorded', description: `Batch ${batchNo} · Labelling: ${labellingDateFormatted}` });
    onComplete?.();
    setSaving(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-cyan-600" />
        <h2 className="text-base font-semibold text-slate-900">Record Stock Transfer</h2>
      </div>

      {/* Transfer + Labelling Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Transfer Quantity (Bottles)</Label>
          <Input type="number" value={qty} readOnly className="h-11 md:h-9 bg-slate-50 text-slate-700 cursor-not-allowed" />
          <p className="text-xs text-slate-500">Fixed as per shift plan</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Labelling Start Date</Label>
          <Input type="date" value={labellingDate} readOnly className="h-11 md:h-9 bg-slate-50 text-slate-700 cursor-not-allowed" />
          <p className="text-xs text-slate-500">Locked to today's date</p>
        </div>
      </div>

      {/* Manufacturing date reference */}
      {mfgDate && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
          Manufacturing Date: <span className="font-semibold text-slate-700">{mfgDate}</span>
          {product?.product_prefix_code && (
            <span className="ml-4">
              Prefix: <span className="font-semibold text-slate-700">{product.product_prefix_code}</span>
            </span>
          )}
          {product?.flavour_code && (
            <span className="ml-4">
              Flavour Code: <span className="font-semibold text-slate-700">{product.flavour_code}</span>
            </span>
          )}
        </div>
      )}

      {/* Batch Number */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-700">Batch Number <span className="text-red-500">*</span></Label>
        <div className="flex gap-2">
          <Input
            value={batchNo}
            onChange={e => setBatchNo(e.target.value)}
            placeholder="e.g. 02GL46022 or KFB31L2501"
            className="h-11 md:h-9 font-mono"
          />
          <Button
            variant="outline"
            className="h-11 md:h-9 gap-1.5 shrink-0"
            onClick={handleRegenerate}
            title="Re-generate batch number"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline text-sm">Generate</span>
          </Button>
        </div>

        {/* Scheme explanation */}
        {product && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-700 space-y-0.5">
              <p className="font-semibold">{schemeInfo?.label}</p>
              <p>{schemeInfo?.description}</p>
              <p>Example: <span className="font-mono font-bold">{schemeInfo?.example}</span></p>
              {!canAutogenerate && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                  ⚠ Product is missing <strong>Prefix Code</strong> or <strong>Flavour Code</strong> in Product Master. Enter batch manually.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sequence field (only for day_year_seq scheme) */}
        {product?.batch_scheme === 'day_year_seq' && (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Daily Batch Sequence (1–99)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={batchSeq}
                min={1}
                max={99}
                onChange={e => setBatchSeq(e.target.value)}
                className="h-11 md:h-9 w-24"
              />
              <p className="text-xs text-slate-500">Increments if multiple batches are run on the same day for this product</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">Remarks (Optional)</Label>
        <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any notes..." className="min-h-[60px]" />
      </div>

      {/* Label Preview — shows MRP, expiry, bottle size, USP/ml */}
      <LblLabelPreviewCard
        productName={job?.product_name}
        batchNo={batchNo}
        mrp={product?.mrp || job?.mrp}
        mlPerBottle={product?.ml_per_bottle}
        mfgDate={mfgDate}
        labellingDate={labellingDate}
        shelfLifeDays={product?.shelf_life_days}
        shelfLifeUnit={product?.shelf_life_unit || 'months'}
        fssaiNo={product?.fssai_no}
        bottleType={job?.bottle_type || product?.bottle_type}
        templateName={product?.demo_template || product?.bulk_template}
      />

      <div className="flex flex-col md:flex-row gap-2">
        <Button className="h-11 w-full md:w-auto gap-2" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
          Submit Stock Transfer
        </Button>
        <LblBoxLabelPrintButton
          job={job}
          overrides={{ batch_no: batchNo, stock_transfer_qty: Number(qty) || undefined }}
          className="w-full md:w-auto"
        />
      </div>
    </div>
  );
}