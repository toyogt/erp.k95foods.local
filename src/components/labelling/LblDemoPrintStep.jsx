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

    // Build command — quantity equals demo print count (one data command per label)
    const qty = Number(demoQty);
    // All POD fields computed from current inputs
    const podFields = computeLabelFields({
      mrp: labelData.mrp,
      mlPerBottle: productMaster?.ml_per_bottle,
      mfgDate: labelData.mfg_date,
      labellingDate: job.labelling_date || '',
      shelfLifeDays: productMaster?.shelf_life_days,
      batchNo: labelData.batch_no,
      productName: job.product_name,
    });

    const command = {
      type: 'demo',
      template: printer.demo_template || printer.default_template || '',
      data_commands: qty,
      quantity: qty,
      job_id: job.job_id,
      // All POD fields for Rynan middleware
      label_data: {
        POD1: podFields.mrp,
        POD2: podFields.mrpWithUsp,
        POD3: podFields.taxLine,
        POD4: podFields.batchNo,
        POD5: podFields.mfgDate,
        POD6: podFields.expiryDate,
        POD7: podFields.usp,
        POD8: podFields.mfgDateOffset,
        POD9: podFields.expiryDateOffset,
        POD10: podFields.netWeight,
        POD11: podFields.uspWithUnit,
        POD12: podFields.mrpAndUsp,
        // Legacy keys for backward compat
        batch_no: podFields.batchNo,
        mfg_date: podFields.mfgDate,
        exp_date: podFields.expiryDate,
        mrp: podFields.mrp,
        usp: podFields.usp,
        product_name: job.product_name,
        sku_code: job.sku_code,
      },
    };

    const result = await sendRynanPrintCommand(printer, command, {
      jobId: job.id,
      commandType: 'demo',
      quantity: qty,
      user,
    });

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
      description: `Demo print of ${qty} labels sent to ${printer.name}. Batch: ${podFields.batchNo}, MFG: ${podFields.mfgDate}, EXP: ${podFields.expiryDate}, MRP: ₹${podFields.mrp}, USP: ₹${podFields.usp}/ml. Middleware job: ${result.middlewareJobId || 'N/A'}`,
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
            ? `${Number(demoQty)} data command(s) will be sent to the printer (one per label)`
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