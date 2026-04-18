/**
 * LblBoxLabelPrint
 *
 * Renders a box label preview using BoxLabelTemplate populated from the
 * current labelling job and product master data. Provides a "Print Box Label"
 * button that opens a print-only window for the label.
 *
 * Designed to be shown at the Stock Transfer step and Stock Transferred state
 * so operators can print the box label immediately after recording transfer.
 *
 * Pre-fills:
 *   - Product name, brand, manufacturer, addresses, FSSAI, contact info (ProductMaster)
 *   - Batch number, Manufacturing Date, Expiry Date (from job + product shelf life)
 *   - MRP box, bottles per box, ml per bottle, gross weight (ProductMaster)
 *   - Barcode: product_barcode from ProductMaster
 *   - QR: box_serial = job.job_id (unique per job)
 */

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import BoxLabelTemplate from '@/components/labels/BoxLabelTemplate';
import { computeLabelFields } from '@/lib/labelFieldComputer';
import { Printer, Package2 } from 'lucide-react';

export default function LblBoxLabelPrint({ job }) {
  const printRef = useRef(null);

  // Load ProductMaster for this job's SKU
  const { data: productList = [] } = useQuery({
    queryKey: ['product-master-box-label', job?.sku_code],
    queryFn:  () => base44.entities.ProductMaster.filter({ item_code: job?.sku_code }),
    enabled:  !!job?.sku_code,
  });
  const product = productList[0] || null;

  if (!job || !product) return null;

  // Compute expiry from Manufacturing Date + shelf life
  const computed = computeLabelFields({
    mrp:           product.mrp || job.mrp,
    mlPerBottle:   product.ml_per_bottle,
    mfgDate:       job.manufacturing_date || '',
    shelfLifeDays: product.shelf_life_days,
    shelfLifeUnit: product.shelf_life_unit || 'months',
    batchNo:       job.batch_no || '',
    productName:   job.product_name,
  });

  // Convert DD/MM/YYYY → YYYY-MM-DD for BoxLabelTemplate's fmtDate function
  function toIso(ddmmyyyy) {
    if (!ddmmyyyy) return '';
    const parts = ddmmyyyy.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return ddmmyyyy;
  }

  // Label data object expected by BoxLabelTemplate
  const labelData = {
    batch_no:   job.batch_no || '—',
    mfg_date:   toIso(computed.mfgDate),
    exp_date:   toIso(computed.expiryDate),
    box_serial: job.job_id || '',
    qr_payload: job.job_id || '',
    item_code:  job.sku_code || '',
    printed_at: new Date().toISOString(),
  };

  // Product data object expected by BoxLabelTemplate
  const productData = {
    brand_name:        product.brand_name || '',
    product_name:      job.product_name || product.product_name || '',
    flavour:           product.flavour || '',
    bottles_per_box:   product.bottles_per_box,
    ml_per_bottle:     product.ml_per_bottle,
    gross_weight_kg:   product.gross_weight_kg,
    mrp_box:           product.mrp_box,
    product_barcode:   product.product_barcode || product.item_code || '',
    item_code:         product.item_code || '',
    manufacturer_name: product.manufacturer_name || '',
    address_1:         product.address_1 || '',
    address_2:         product.address_2 || '',
    fssai_no:          product.fssai_no || '',
    customer_care_phone: product.customer_care_phone || '',
    customer_care_email: product.customer_care_email || '',
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    const labelHtml   = printRef.current?.innerHTML || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Box Label — ${job.job_id}</title>
          <style>
            @page { size: 4in 6in; margin: 0; }
            body { margin: 0; padding: 0; background: #fff; }
            .box-label-page { page-break-after: avoid; }
          </style>
        </head>
        <body>
          ${labelHtml}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const hasExpiryDate = !!computed.expiryDate;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Package2 className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-700">Box Label</span>
          {job.batch_no && (
            <span className="text-xs text-slate-500 font-mono bg-white border border-slate-200 px-2 py-0.5 rounded">
              {job.batch_no}
            </span>
          )}
        </div>
        <Button
          className="h-9 gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm"
          onClick={handlePrint}
        >
          <Printer className="w-4 h-4" />
          Print Box Label
        </Button>
      </div>

      {/* Missing expiry warning */}
      {!hasExpiryDate && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          Expiry date cannot be calculated — check that the product has a shelf life configured in Product Master.
        </div>
      )}

      {/* Label preview — centred, scaled to fit screen */}
      <div className="p-4 overflow-auto bg-slate-100 flex justify-center">
        <div
          ref={printRef}
          style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: '-60px' }}
        >
          <BoxLabelTemplate label={labelData} product={productData} />
        </div>
      </div>
    </div>
  );
}