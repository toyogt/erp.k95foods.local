/**
 * LblDemoPrintStep
 * Sends a demo print command to the Rynan middleware.
 * - Checks cartridge presence before allowing print
 * - Collects all label data: batch number, manufacturing date, expiry date, MRP, USP
 * - MRP is pre-filled from ProductMaster and is editable
 * - Number of data commands sent = demo print quantity
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { sendRynanPrintCommand } from '@/lib/rynanPrinterService';
import { toast } from '@/components/ui/use-toast';
import { computeLabelFields } from '@/lib/labelFieldComputer';
import { resolveDemoPrintLabelData } from '@/lib/buildRynanLabelData';
import LblPrinterStatusPanel from './LblPrinterStatusPanel';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';

export default function LblDemoPrintStep({ job, user, onComplete }) {
  const [demoQty, setDemoQty] = useState('2');
  const [printerId, setPrinterId] = useState('');
  const [sending, setSending] = useState(false);
  const [printerStatus, setPrinterStatus] = useState(null);

  // Label data fields — pre-filled from job/product, all editable
  const [labelData, setLabelData] = useState({
    batch_no: job.batch_no || '',
    mfg_date: job.manufacturing_date || '',  // DD/MM/YYYY
    exp_date: '',                            // auto-computed from mfg + shelf life
    mrp: job.mrp || '',
  });

  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn: () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  // Load the print template linked to this job (from SKU's print_template_mappings.demo_print)
  const { data: jobTemplate } = useQuery({
    queryKey: ['lbl-job-print-template', job.printer_template_id],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
    enabled: true,
    select: (rows) => rows.find(t => t.id === job.printer_template_id) || null,
  });

  // Fetch SKU's POD field mapping config (payload_map_json from SKUPrintMapping)
  const { data: skuPrintMapping } = useQuery({
    queryKey: ['sku-print-mapping-for-demo', job.sku_code],
    queryFn: () => base44.entities.SKUPrintMapping.filter({ sku_code: job.sku_code }),
    enabled: !!job.sku_code,
    select: (rows) => {
      const mapping = rows?.[0];
      if (!mapping?.payload_map_json) return [];
      try { return JSON.parse(mapping.payload_map_json); } catch { return []; }
    },
  });

  // Fetch product master to get MRP and shelf life
  const { data: productMaster } = useQuery({
    queryKey: ['product-master-for-demo', job.sku_code],
    queryFn: () => base44.entities.ProductMaster.filter({ item_code: job.sku_code }),
    enabled: !!job.sku_code,
    select: (rows) => rows?.[0] || null,
  });

  // Pre-fill MRP when product master loads (if not already set from job)
  useEffect(() => {
    if (!productMaster) return;
    const mrp = job.mrp || (productMaster.mrp != null ? String(productMaster.mrp) : '');
    setLabelData(prev => ({ ...prev, mrp }));
  }, [productMaster]);

  // Always compute expiry from mfg date + shelf life (derived, not stored)
  const computed = computeLabelFields({
    mrp: labelData.mrp,
    mlPerBottle: productMaster?.ml_per_bottle,
    mfgDate: labelData.mfg_date,
    labellingDate: job.labelling_date || '',
    shelfLifeDays: productMaster?.shelf_life_days,
    batchNo: labelData.batch_no,
    productName: job.product_name,
  });

  const selectedPrinter = printers.find(p => p.printer_id === printerId) || null;
  const noPrinters = printers.length === 0;
  const hasCartridge = printerStatus?.has_cartridge === true;
  const statusChecked = printerStatus !== null;

  const setField = (key, val) => setLabelData(prev => ({ ...prev, [key]: val }));

  const handleSendDemoPrint = async () => {
    if (!demoQty || Number(demoQty) <= 0) { toast({ title: 'Invalid Quantity', variant: 'destructive' }); return; }
    if (!printerId) { toast({ title: 'Select a printer first', variant: 'destructive' }); return; }
    if (!statusChecked) { toast({ title: 'Check Printer Status First', description: 'Click "Check Status" to verify cartridge before printing.', variant: 'destructive' }); return; }
    if (!hasCartridge) { toast({ title: 'No Cartridge Detected', description: 'Cannot send demo print — please install a cartridge and check status again.', variant: 'destructive' }); return; }
    if (!labelData.batch_no) { toast({ title: 'Batch Number is required', variant: 'destructive' }); return; }
    if (!labelData.mfg_date) { toast({ title: 'Manufacturing Date is required', variant: 'destructive' }); return; }
    if (!labelData.mrp) { toast({ title: 'MRP is required', variant: 'destructive' }); return; }

    const printer = selectedPrinter;
    setSending(true);

    const qty = Number(demoQty);

    // Compute label fields for audit log only (not sent to middleware — template handles data on printer side)
    const { computedFields: podFields } = resolveDemoPrintLabelData({
      job,
      productMaster,
      labelInputs: {
        mrp:      labelData.mrp,
        mfg_date: labelData.mfg_date,
        batch_no: labelData.batch_no,
      },
      skuPodMappings: skuPrintMapping || [],
    });

    // Resolve middleware template name:
    // 1. Template linked to job via SKU Setup → Printing tab (most specific)
    // 2. Printer's configured demo template
    // 3. Printer's default template
    const resolvedTemplateName = jobTemplate?.middleware_template_name
      || printer.demo_template
      || printer.default_template
      || '';

    if (!resolvedTemplateName) {
      toast({ title: 'No Template Configured', description: 'Assign a print template to this product in SKU Setup → Printing & Batch tab.', variant: 'destructive' });
      setSending(false);
      return;
    }

    // Middleware contract: POST /print with { printer_id, printer:{ip,port}, command:{command,templatename}, priority }
    // One call per label — send qty times sequentially so middleware processes each as a discrete job
    let lastResult = null;
    for (let i = 0; i < qty; i++) {
      lastResult = await sendRynanPrintCommand(
        printer,
        { templateName: resolvedTemplateName, commandString: 'STAR' },
        { jobId: job.id, commandType: 'demo', quantity: 1, user }
      );
      if (!lastResult.success) break;
    }
    const result = lastResult;

    if (!result.success) {
      toast({ title: 'Demo Print Failed', description: result.errorMessage || 'Middleware returned an error', variant: 'destructive' });
      await logLabellingEvent({ action_type: 'printer_command_failed', job_id: job.id, plan_id: job.plan_id, description: `Demo print failed: ${result.errorMessage}`, user });
      setSending(false);
      return;
    }

    await base44.entities.LabellingJob.update(job.id, {
      status: 'demo_print_sent',
      demo_print_qty: qty,
      demo_print_command_id: result.commandRecord?.command_id || null,
      demo_print_middleware_job_id: result.middlewareJobId || null,
    });

    await logLabellingEvent({
      action_type: 'demo_print_sent',
      job_id: job.id,
      plan_id: job.plan_id,
      description: `Demo print of ${qty} label(s) sent to ${printer.name} using template "${resolvedTemplateName}". Batch: ${podFields.batchNo}, MFG: ${podFields.mfgDate}, EXP: ${podFields.expiryDate}, MRP: ₹${podFields.mrp}. Middleware job: ${result.middlewareJobId || 'N/A'}.`,
      user,
    });

    toast({ title: 'Demo Print Sent', description: `${qty} demo label(s) sent. Proceed to verify physical output.` });
    onComplete?.();
    setSending(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Printer className="w-5 h-5 text-purple-600" />
        <h2 className="text-base font-semibold text-slate-900">Send Demo Print</h2>
      </div>

      {/* Job Summary */}
      <div className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
        <p className="text-slate-600"><span className="font-medium">Product:</span> {job.product_name}</p>
        <p className="text-slate-600"><span className="font-medium">Product Code:</span> {job.sku_code}</p>
        <p className="text-slate-600"><span className="font-medium">Planned:</span> {job.quantity_bottles_planned?.toLocaleString()} bottles</p>
        <p className="text-slate-600"><span className="font-medium">Stock Transferred:</span> {job.stock_transfer_qty?.toLocaleString()} bottles</p>
        <p className="text-slate-600 col-span-2">
          <span className="font-medium">Label Template:</span>{' '}
          {jobTemplate
            ? <span className="font-mono text-purple-700">{jobTemplate.name} [{jobTemplate.middleware_template_name}]</span>
            : <span className="text-amber-600">⚠ No template assigned — set in SKU Setup → Printing & Batch tab</span>
          }
        </p>
      </div>

      {noPrinters && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">No active printers configured. Please configure a printer in Lines &amp; Printers settings.</p>
        </div>
      )}

      {/* Printer Selection */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">Select Printer <span className="text-red-500">*</span></Label>
        <Select value={printerId} onValueChange={(v) => { setPrinterId(v); setPrinterStatus(null); }}>
          <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select printer" /></SelectTrigger>
          <SelectContent>
            {printers.map(p => (
              <SelectItem key={p.printer_id} value={p.printer_id}>{p.name} ({p.printer_id}) — {p.line_name || 'No line'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Printer Status Panel — shown once a printer is selected */}
      {selectedPrinter && (
        <LblPrinterStatusPanel
          printer={selectedPrinter}
          job={job}
          user={user}
          onStatusFetched={setPrinterStatus}
        />
      )}

      {/* Label Data Section */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Label Print Data</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Batch Number */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Batch Number <span className="text-red-500">*</span></Label>
            <Input
              value={labelData.batch_no}
              onChange={e => setField('batch_no', e.target.value)}
              className="h-11 md:h-9 font-mono"
              placeholder="e.g. 02GL46022"
            />
          </div>

          {/* MRP — pre-filled from Product Master, editable */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">
              MRP (₹) <span className="text-red-500">*</span>
              {productMaster?.mrp != null && (
                <span className="ml-1 text-slate-400 font-normal">(from Product setup: ₹{productMaster.mrp})</span>
              )}
            </Label>
            <Input
              type="number"
              value={labelData.mrp}
              onChange={e => setField('mrp', e.target.value)}
              className="h-11 md:h-9"
              placeholder="e.g. 30"
              min="0"
            />
          </div>

          {/* Manufacturing Date */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Manufacturing Date <span className="text-red-500">*</span></Label>
            <Input
              value={labelData.mfg_date}
              onChange={e => setField('mfg_date', e.target.value)}
              className="h-11 md:h-9"
              placeholder="DD/MM/YYYY"
              maxLength={10}
            />
            <p className="text-xs text-slate-500">Format: DD/MM/YYYY</p>
          </div>

          {/* Expiry Date — auto-computed from MFG date + shelf life */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">
              Expiry / Use By Date
              {productMaster?.shelf_life_days && (
                <span className="ml-1 text-slate-400 font-normal">(auto: {productMaster.shelf_life_days} days from MFG)</span>
              )}
            </Label>
            <div className="h-11 md:h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md">
              <span className={`text-sm font-mono ${computed.expiryDate ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                {computed.expiryDate || 'Enter MFG date above'}
              </span>
            </div>
          </div>

          {/* USP — auto-computed from MRP / ml */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">USP (Cost per ml) — auto-computed</Label>
            <div className="h-11 md:h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md">
              <span className={`text-sm ${computed.uspWithUnit ? 'text-green-700 font-semibold' : 'text-slate-400'}`}>
                {computed.uspWithUnit || 'Enter MRP and volume in product setup'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Quantity */}
      <div className="space-y-1 max-w-xs">
        <Label className="text-xs font-medium text-slate-700">Demo Print Quantity (Labels)</Label>
        <Input
          type="number"
          value={demoQty}
          onChange={e => setDemoQty(e.target.value)}
          className="h-11 md:h-9"
          min="1"
        />
        <p className="text-xs text-slate-500">
          {demoQty && Number(demoQty) > 0
            ? `${Number(demoQty)} separate /print request(s) will be sent to the middleware — one per label`
            : 'Number of sample labels to print for approval'}
        </p>
      </div>

      {/* Action — disabled if no cartridge detected */}
      <div className="pt-1">
        {statusChecked && !hasCartridge && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 font-medium">No cartridge detected — cannot send demo print.</p>
          </div>
        )}
        {!statusChecked && printerId && (
          <p className="text-xs text-amber-600 mb-2">⚠ Check printer status above before sending.</p>
        )}
        <Button
          className="h-11 w-full md:w-auto gap-2 bg-purple-600 hover:bg-purple-700"
          onClick={handleSendDemoPrint}
          disabled={sending || noPrinters || !printerId || (statusChecked && !hasCartridge)}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Send Demo Print
        </Button>
      </div>
    </div>
  );
}