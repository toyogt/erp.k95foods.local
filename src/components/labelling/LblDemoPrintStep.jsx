/**
 * LblDemoPrintStep
 * Sends a demo print using the template selected at plan creation.
 * - No command type branching — same template used throughout job
 * - Checks cartridge, collects label data, sends to middleware
 * - Preview modal allows operator to verify before printing
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { computeLabelFields } from '@/lib/labelFieldComputer';
import { resolveDemoPrintLabelData } from '@/lib/buildRynanLabelData';
import { sendStarCommand } from '@/lib/rynanPrinterService';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import LblPrinterStatusPanel from './LblPrinterStatusPanel';
import LblPrintPreviewModal from './LblPrintPreviewModal';
import { Link } from 'react-router-dom';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';

export default function LblDemoPrintStep({ job, user, onComplete }) {
  const [demoQty, setDemoQty] = useState('2');
  const [printerId, setPrinterId] = useState('');
  const [sending, setSending] = useState(false);
  const [printerStatus, setPrinterStatus] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPodValues, setPreviewPodValues] = useState(null);

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

  // Load the selected template (assigned at plan creation)
  const { data: jobTemplate } = useQuery({
    queryKey: ['lbl-job-print-template', job.printer_template_id],
    queryFn: async () => {
      if (!job.printer_template_id) return null;
      const templates = await base44.entities.LblPrintTemplate.filter({ is_active: true });
      return templates.find(t => t.id === job.printer_template_id) || null;
    },
    enabled: !!job.printer_template_id,
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
    shelfLifeUnit: productMaster?.shelf_life_unit || 'months',
    batchNo: labelData.batch_no,
    productName: job.product_name,
  });

  const selectedPrinter = printers.find(p => p.printer_id === printerId) || null;
  const noPrinters = printers.length === 0;
  const hasCartridge = printerStatus?.has_cartridge === true;
  // Only block if we confirmed the template is definitely NOT there (list was readable but name absent)
  const templateMissing = printerStatus?.templateFound === false && !printerStatus?.templateListUnavailable;
  const statusChecked = printerStatus !== null;
  const templateName = jobTemplate?.middleware_template_name || '';

  const setField = (key, val) => setLabelData(prev => ({ ...prev, [key]: val }));

  const handlePreviewPrint = () => {
    if (!demoQty || Number(demoQty) <= 0) { toast({ title: 'Invalid Quantity', variant: 'destructive' }); return; }
    if (!printerId) { toast({ title: 'Select a printer first', variant: 'destructive' }); return; }
    if (!statusChecked) { toast({ title: 'Check Printer Status First', description: 'Click "Check Status" to verify cartridge before printing.', variant: 'destructive' }); return; }
    if (!hasCartridge) { toast({ title: 'No Cartridge Detected', description: 'Cannot send demo print — please install a cartridge and check status again.', variant: 'destructive' }); return; }
    if (templateMissing) { toast({ title: 'Template Not Found on Printer', description: `Template "${templateName}" is not loaded on the printer. Contact your middleware administrator.`, variant: 'destructive' }); return; }
    if (!labelData.batch_no) { toast({ title: 'Batch Number is required', variant: 'destructive' }); return; }
    if (!labelData.mfg_date) { toast({ title: 'Manufacturing Date is required', variant: 'destructive' }); return; }
    if (!labelData.mrp) { toast({ title: 'MRP is required', variant: 'destructive' }); return; }

    // Build POD values for preview using template field mappings
    // Full lookup table — snake_case erp_source keys → resolved values
    // Uses `computed` from computeLabelFields for all derived/formatted values
    const erpValueMap = {
      // Batch & Dates (use computed for formatted values)
      batch_no:             computed.batchNo,
      mfg_date:             computed.mfgDate,
      manufacturing_date:   computed.mfgDate,
      expiry_date:          computed.expiryDate,
      shelf_life:           productMaster?.shelf_life_days ? `${productMaster.shelf_life_days} ${productMaster.shelf_life_unit || 'months'}` : '',
      batch_seq:            job.batch_seq ? String(job.batch_seq) : '',
      // Pricing (use computed for USP-derived values)
      mrp:                  computed.mrp,
      mrp_with_usp:         computed.mrpWithUsp,
      usp:                  computed.usp,
      usp_with_unit:        computed.uspWithUnit,
      mrp_and_usp:          computed.mrpAndUsp,
      tax_line:             computed.taxLine,
      net_weight:           computed.netWeight,
      // Offset dates for variant SKUs
      mfg_date_offset:      computed.mfgDateOffset,
      expiry_date_offset:   computed.expiryDateOffset,
      // Product info (from job + product master)
      sku_code:             job.sku_code,
      product_name:         job.product_name || computed.productName,
      bottle_type:          job.bottle_type || productMaster?.bottle_type || '',
      brand_name:           productMaster?.brand_name || '',
      flavour:              productMaster?.flavour || '',
      // Volume & quantity
      ml_per_bottle:        productMaster?.ml_per_bottle ? String(productMaster.ml_per_bottle) : '',
      bottles_per_box:      productMaster?.bottles_per_box ? String(productMaster.bottles_per_box) : '',
      quantity_bottles:     job.quantity_bottles_planned ? String(job.quantity_bottles_planned) : '',
      quantity_cases:       job.quantity_cases_planned ? String(job.quantity_cases_planned) : '',
      // Regulatory
      fssai_no:             productMaster?.fssai_no || '',
      manufacturer_name:    productMaster?.manufacturer_name || '',
      manufacturer_address: [productMaster?.address_1, productMaster?.address_2].filter(Boolean).join(', '),
      customer_care_phone:  productMaster?.customer_care_phone || '',
      customer_care_email:  productMaster?.customer_care_email || '',
      hsn_code:             productMaster?.hsn_code || '',
      // Barcodes
      product_barcode:      productMaster?.product_barcode || '',
      box_barcode:          productMaster?.box_barcode || '',
      // Line/shift
      line_id:              job.line_id || '',
      shift_type:           job.shift_type || '',
      labelling_date:       job.labelling_date || '',
    };

    const podMap = {};
    if (jobTemplate?.field_mappings && jobTemplate.field_mappings.length > 0) {
      jobTemplate.field_mappings.forEach(mapping => {
        podMap[mapping.pod_field] = erpValueMap[mapping.erp_source] ?? '';
      });
    }

    setPreviewPodValues(podMap);
    setShowPreview(true);
  };

  const handleConfirmPrint = async () => {
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
      skuPodMappings: [],
    });

    if (!jobTemplate) {
      toast({ title: 'No Template Configured', description: 'This job has no print template assigned. Ensure a template was selected during plan creation.', variant: 'destructive' });
      setSending(false);
      return;
    }

    // Send qty STAR commands using the selected template
    const result = await sendStarCommand(
      printer,
      templateName,
      qty,
      { jobId: job.id, commandType: 'demo', user }
    );

    if (!result.success) {
      // Show specific popup based on MON template check result
      if (result.templateNotOnPrinter) {
        toast({
          title: 'Template Not Found on Printer',
          description: `Unable to print — the template "${templateName}" does not exist on the printer. Please load the template onto the printer before printing.`,
          variant: 'destructive',
          duration: 8000,
        });
      } else if (result.templateExistsButFailed) {
        toast({
          title: 'Template Cannot Be Activated',
          description: `The template "${templateName}" exists on the printer but could not be set as the active template after ${5} attempts. Contact your administrator.`,
          variant: 'destructive',
          duration: 8000,
        });
      } else {
        toast({
          title: 'Demo Print Failed',
          description: result.errorMessage || 'Middleware returned an error. Please check printer connection.',
          variant: 'destructive',
          duration: 6000,
        });
      }
      await logLabellingEvent({ action_type: 'printer_command_failed', job_id: job.id, plan_id: job.plan_id, description: `Demo print failed after ${result.sentCount} of ${qty} label(s): ${result.errorMessage}`, user });
      setSending(false);
      return;
    }

    await base44.entities.LabellingJob.update(job.id, {
      status: 'demo_print_sent',
      demo_print_qty: qty,
      demo_print_command_id: result.lastCommandRecord?.command_id || null,
      demo_print_middleware_job_id: result.lastMiddlewareJobId || null,
    });

    await logLabellingEvent({
      action_type: 'demo_print_sent',
      job_id: job.id,
      plan_id: job.plan_id,
      description: `Demo print of ${qty} label(s) sent to ${printer.name} using template "${templateName}". Batch: ${podFields.batchNo}, MFG: ${podFields.mfgDate}, EXP: ${podFields.expiryDate}, MRP: ₹${podFields.mrp}. Middleware job: ${result.lastMiddlewareJobId || 'N/A'}.`,
      user,
    });

    toast({ title: 'Demo Print Sent', description: `${qty} demo label(s) sent. Proceed to verify physical output.` });
    setShowPreview(false);
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
          <span className="font-medium">Selected Template:</span>{' '}
          {jobTemplate
            ? <Link to="/LblPrintTemplateManager" className="font-mono text-purple-700 hover:text-purple-900 underline underline-offset-2">{jobTemplate.name} [{templateName}]</Link>
            : <span className="text-amber-600">⚠ No template assigned — select during plan creation</span>
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
        {noPrinters ? (
          <div className="h-11 md:h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md text-slate-500 text-sm">
            No printers available
          </div>
        ) : (
          <Select value={printerId} onValueChange={(v) => { setPrinterId(v); setPrinterStatus(null); }}>
            <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select printer" /></SelectTrigger>
            <SelectContent>
              {printers.map(p => (
                <SelectItem key={p.printer_id} value={p.printer_id}>{p.name} ({p.printer_id}) — {p.line_name || 'No line'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Printer Status Panel — shown once a printer is selected */}
      {selectedPrinter && (
        <LblPrinterStatusPanel
          printer={selectedPrinter}
          job={job}
          user={user}
          templateName={templateName || undefined}
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
          onClick={handlePreviewPrint}
          disabled={sending || noPrinters || !printerId || (statusChecked && !hasCartridge) || (statusChecked && templateMissing)}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Send Demo Print
        </Button>
      </div>

      {/* Preview Modal */}
      <LblPrintPreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        podValues={previewPodValues}
        printerName={selectedPrinter?.name}
        templateName={templateName}
        quantity={Number(demoQty)}
        onConfirm={handleConfirmPrint}
        isLoading={sending}
      />
    </div>
  );
}