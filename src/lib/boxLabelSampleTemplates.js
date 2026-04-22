/**
 * Pre-built sample templates for the Box Label Builder.
 * Returns an elements array + page size that the builder can load.
 */
import { newElementId } from '@/lib/boxLabelHelpers';

/**
 * 4 x 6 inch (portrait) box label — matches reference image layout.
 * Coordinates stored in inches; font sizes in points.
 *
 * Layout: two-column table (label | value), bold black text, plus
 * SKU barcode at the bottom.
 */
export function build6x4SampleTemplate() {
  const PAGE_W = 4;     // inch (portrait)
  const PAGE_H = 6;     // inch (portrait)
  const M = 0.08;       // outer margin (inch)
  const LABEL_COL = 1.2;
  const VALUE_X = M + LABEL_COL;
  const VALUE_W = PAGE_W - M * 2 - LABEL_COL;

  const elements = [];

  // Table rows — total ~4.85", leaving ~1" at the bottom for barcode
  const rows = [
    { label: 'Item Code',    field: 'sku.item_code',           h: 0.40, labelFs: 14, valueFs: 16 },
    { label: '',             field: 'sku.product_name',        h: 0.80, labelFs: 16, valueFs: 18, fullWidth: true, valueOnly: true, textAlign: 'center' },
    { label: 'Batch No.',    field: 'job.batch_no',            h: 0.38, labelFs: 12, valueFs: 14 },
    { label: 'Manuf Date',   field: 'job.manufacturing_date',  h: 0.38, labelFs: 12, valueFs: 14 },
    { label: 'Expiry Date',  field: 'job.expiry_date',         h: 0.38, labelFs: 12, valueFs: 14 },
    { label: 'No of Pcs',    field: null,                      h: 0.38, labelFs: 12, split: true },
    { label: 'Manuf By',     field: 'sku.manufacturer_name',   h: 0.38, labelFs: 12, valueFs: 13 },
    { label: 'Address :',    field: 'computed.full_address',   h: 0.55, labelFs: 12, valueFs: 12, fullWidth: true },
    { label: 'Phone No.',    field: 'sku.customer_care_phone', h: 0.35, labelFs: 12, valueFs: 13 },
    { label: 'FSSAI No.',    field: 'sku.fssai_no',            h: 0.35, labelFs: 12, valueFs: 13 },
  ];

  let y = M;

  for (const row of rows) {
    if (row.fullWidth) {
      // Single-cell row that spans full width (e.g. Item Name, Address)
      const el = {
        id: newElementId(),
        type: 'text',
        x: M,
        y,
        width: PAGE_W - M * 2,
        height: row.h,
        rotation: 0,
        font_size: row.valueFs,
        font_weight: '800',
        text_align: row.textAlign || 'left',
        color: '#000000',
      };
      if (row.valueOnly) {
        // Just the dynamic value, no static label prefix
        el.data_field = row.field;
      } else {
        // Static label + dynamic value template
        el.text_content = `${row.label} {{${row.field}}}`;
      }
      elements.push(el);
      y += row.h;
      continue;
    }

    // Left label cell
    elements.push({
      id: newElementId(),
      type: 'text',
      x: M,
      y,
      width: LABEL_COL,
      height: row.h,
      rotation: 0,
      text_content: row.label,
      font_size: row.labelFs,
      font_weight: '800',
      text_align: 'left',
      color: '#000000',
    });

    if (row.split) {
      // "[12]  Weight : [7.60 Kg]"
      const cellW = VALUE_W / 4;
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X, y, width: cellW * 0.9, height: row.h, rotation: 0,
        data_field: 'sku.bottles_per_box',
        font_size: 14, font_weight: '800', text_align: 'left', color: '#000000',
      });
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X + cellW * 0.9, y, width: cellW * 1.3, height: row.h, rotation: 0,
        text_content: 'Weight :',
        font_size: 12, font_weight: '800', text_align: 'left', color: '#000000',
      });
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X + cellW * 2.2, y, width: cellW * 1.8, height: row.h, rotation: 0,
        data_field: 'computed.gross_weight',
        font_size: 14, font_weight: '800', text_align: 'left', color: '#000000',
      });
    } else {
      elements.push({
        id: newElementId(),
        type: 'text',
        x: VALUE_X,
        y,
        width: VALUE_W,
        height: row.h,
        rotation: 0,
        data_field: row.field,
        font_size: row.valueFs,
        font_weight: '800',
        text_align: 'left',
        color: '#000000',
      });
    }

    y += row.h;
  }

  // SKU Barcode at the bottom
  const barcodeY = y + 0.05;
  const barcodeH = Math.max(0.6, PAGE_H - M - barcodeY);
  elements.push({
    id: newElementId(),
    type: 'barcode',
    x: M,
    y: barcodeY,
    width: PAGE_W - M * 2,
    height: barcodeH,
    rotation: 0,
    data_field: 'sku.product_barcode',
    barcode_type: 'CODE128',
    color: '#000000',
  });

  return {
    page_unit: 'inch',
    page_width: PAGE_W,
    page_height: PAGE_H,
    elements,
  };
}