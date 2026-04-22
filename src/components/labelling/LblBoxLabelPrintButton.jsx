/**
 * LblBoxLabelPrintButton
 * Renders a "Print Box Label" action for a labelling job.
 * - Fetches the SKU's mapped BoxLabelTemplate (ProductMaster.box_label_template_id)
 * - Merges live job + SKU data into the template fields
 * - Opens a print-ready window sized exactly to template (inch/mm)
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Printer, Loader2 } from 'lucide-react';
import { resolveElementValue } from '@/lib/boxLabelHelpers';
import moment from 'moment';

function buildPreviewData(job, sku, overrides = {}) {
  // Compute expiry from MFG + shelf life
  let expiry = '';
  if (job?.manufacturing_date && sku?.shelf_life_days) {
    const m = moment(job.manufacturing_date, ['DD/MM/YYYY', 'YYYY-MM-DD']);
    if (m.isValid()) {
      const unit = sku.shelf_life_unit || 'months';
      expiry = m.add(Number(sku.shelf_life_days), unit).format('DD/MM/YYYY');
    }
  }
  return {
    job: {
      ...job,
      batch_no: overrides.batch_no || job?.batch_no || '',
      manufacturing_date: job?.manufacturing_date || '',
      expiry_date: expiry,
      stock_transfer_qty: overrides.stock_transfer_qty ?? job?.stock_transfer_qty ?? job?.quantity_bottles_planned ?? '',
    },
    sku: sku || {},
  };
}

function renderElementHtml(el, data) {
  const unit = 'in'; // we normalize in the wrapper — coords passed already in template unit
  const style = [
    'position:absolute',
    `left:${el.x}${unit}`,
    `top:${el.y}${unit}`,
    `width:${el.width}${unit}`,
    `height:${el.height}${unit}`,
    `transform:rotate(${el.rotation || 0}deg)`,
    'box-sizing:border-box',
    'overflow:hidden',
    `color:${el.color || '#000'}`,
  ].join(';');

  const value = resolveElementValue(el, data) || '';

  if (el.type === 'text') {
    const textStyle = [
      `font-size:${el.font_size || 10}pt`,
      `font-weight:${el.font_weight || 'normal'}`,
      `text-align:${el.text_align || 'left'}`,
      'line-height:1.15',
      'padding:1px',
      'white-space:pre-wrap',
      'word-break:break-word',
    ].join(';');
    return `<div style="${style}"><div style="${textStyle}">${escapeHtml(value)}</div></div>`;
  }

  if (el.type === 'image' && el.image_url) {
    return `<div style="${style}"><img src="${el.image_url}" style="width:100%;height:100%;object-fit:contain"/></div>`;
  }

  if (el.type === 'barcode') {
    // Render barcode via bwip-js CDN-free: use a JsBarcode-like inline SVG via Google Charts API
    // Keep it simple: render the value in OCR-B style with vertical bars approximation (printer-agnostic).
    // For true CODE128, use the online barcode generator from BWIP.
    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=${encodeURIComponent((el.barcode_type || 'code128').toLowerCase())}&text=${encodeURIComponent(value || ' ')}&scale=2&includetext&textxalign=center`;
    return `<div style="${style}"><img src="${barcodeUrl}" style="width:100%;height:100%;object-fit:contain" crossorigin="anonymous"/></div>`;
  }

  return '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function openPrintWindow(template, elements, data) {
  const unit = template.page_unit === 'inch' ? 'in' : 'mm';
  const w = template.page_width;
  const h = template.page_height;

  // Rewrite element coords to the chosen unit label
  const body = elements.map(el => {
    const style = [
      'position:absolute',
      `left:${el.x}${unit}`,
      `top:${el.y}${unit}`,
      `width:${el.width}${unit}`,
      `height:${el.height}${unit}`,
      `transform:rotate(${el.rotation || 0}deg)`,
      'box-sizing:border-box',
      'overflow:hidden',
      `color:${el.color || '#000'}`,
    ].join(';');

    const value = resolveElementValue(el, data) || '';

    if (el.type === 'text') {
      const textStyle = [
        `font-size:${el.font_size || 10}pt`,
        `font-weight:${el.font_weight || 'normal'}`,
        `text-align:${el.text_align || 'left'}`,
        'line-height:1.15',
        'padding:1px',
        'white-space:pre-wrap',
        'word-break:break-word',
      ].join(';');
      return `<div style="${style}"><div style="${textStyle}">${escapeHtml(value)}</div></div>`;
    }
    if (el.type === 'image' && el.image_url) {
      return `<div style="${style}"><img src="${el.image_url}" style="width:100%;height:100%;object-fit:contain"/></div>`;
    }
    if (el.type === 'barcode') {
      const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=${encodeURIComponent((el.barcode_type || 'code128').toLowerCase())}&text=${encodeURIComponent(value || ' ')}&scale=2&includetext&textxalign=center`;
      return `<div style="${style}"><img src="${barcodeUrl}" style="width:100%;height:100%;object-fit:contain"/></div>`;
    }
    return '';
  }).join('\n');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Box Label — ${escapeHtml(data?.job?.batch_no || '')}</title>
<style>
  @page { size: ${w}${unit} ${h}${unit}; margin: 0; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family: Arial, Helvetica, sans-serif; color:#000; }
  .sheet { position:relative; width:${w}${unit}; height:${h}${unit}; overflow:hidden; }
  @media screen {
    body { padding: 20px; background:#f1f5f9; }
    .sheet { box-shadow: 0 4px 20px rgba(0,0,0,0.15); background:#fff; }
    .bar { margin:0 0 12px; font:14px Arial; color:#334155; display:flex; gap:8px; }
    .bar button { padding:6px 14px; font-size:13px; cursor:pointer; }
  }
  @media print { .bar { display:none } body { padding:0; background:#fff } .sheet { box-shadow:none } }
</style>
</head>
<body>
  <div class="bar">
    <button onclick="window.print()">Print</button>
    <button onclick="window.close()">Close</button>
    <span>${escapeHtml(data?.sku?.product_name || '')} — Batch ${escapeHtml(data?.job?.batch_no || '')}</span>
  </div>
  <div class="sheet">${body}</div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script>
</body>
</html>`;

  const win = window.open('', '_blank', `width=${Math.min(900, 120 + (unit === 'in' ? w * 96 : w * 3.8))},height=${Math.min(1000, 200 + (unit === 'in' ? h * 96 : h * 3.8))}`);
  if (!win) {
    toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for this site to print.', variant: 'destructive' });
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export default function LblBoxLabelPrintButton({ job, overrides, size = 'md', variant = 'outline', className = '' }) {
  const [loading, setLoading] = useState(false);

  const { data: productList = [] } = useQuery({
    queryKey: ['pm-box-label', job?.sku_code],
    queryFn: () => base44.entities.ProductMaster.filter({ item_code: job?.sku_code }),
    enabled: !!job?.sku_code,
  });
  const sku = productList[0];
  const templateId = sku?.box_label_template_id;

  const handlePrint = async () => {
    if (!sku) {
      toast({ title: 'Product not found', description: 'Cannot find product master for this job.', variant: 'destructive' });
      return;
    }
    if (!templateId) {
      toast({ title: 'No Box Label Template', description: 'Map a Box Label Template to this product in SKU Setup → Printing & Batch.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const template = await base44.entities.BoxLabelTemplate.get(templateId).catch(() => null);
    setLoading(false);
    if (!template) {
      toast({ title: 'Template not found', description: 'The mapped Box Label Template is missing or inactive.', variant: 'destructive' });
      return;
    }
    const data = buildPreviewData(job, sku, overrides);
    openPrintWindow(template, template.elements || [], data);
  };

  const heightCls = size === 'sm' ? 'h-9' : 'h-11';

  return (
    <Button
      onClick={handlePrint}
      disabled={loading}
      variant={variant}
      className={`${heightCls} gap-2 ${className}`}
      type="button"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
      Print Box Label
      {!templateId && sku && <span className="text-xs text-amber-600 ml-1">(no template)</span>}
    </Button>
  );
}