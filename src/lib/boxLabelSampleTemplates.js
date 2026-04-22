/**
 * Pre-built sample templates for the Box Label Builder.
 * Returns an elements array + page size that the builder can load.
 */
import { newElementId } from '@/lib/boxLabelHelpers';

/**
 * 6 x 4 inch box label — matches reference image layout.
 * Coordinates stored in inches; font sizes in points.
 */
export function build6x4SampleTemplate() {
  const PAGE_W = 6;    // inch
  const PAGE_H = 4;    // inch
  const M = 0.1;       // outer margin (inch)
  const LABEL_COL = 1.4; // width of the label (left) column
  const VALUE_X = M + LABEL_COL;
  const VALUE_W = PAGE_W - M * 2 - LABEL_COL;

  const elements = [];

  // Rows — heights in inches, total = 3.8 (leaves small margin)
  const rows = [
    { label: 'Item Code',   field: 'sku.item_code',          h: 0.35, fs: 14, valueFs: 14 },
    { label: 'Item Name :', field: 'sku.product_name',       h: 0.60, fs: 13, valueFs: 13, wrap: true },
    { label: 'Batch No.',   field: 'job.batch_no',           h: 0.30, fs: 11, valueFs: 13 },
    { label: 'Manuf Date',  field: 'job.manufacturing_date', h: 0.30, fs: 11, valueFs: 13 },
    { label: 'Expiry Date', field: 'job.expiry_date',        h: 0.30, fs: 11, valueFs: 13 },
    { label: 'No of Pcs',   field: null,                     h: 0.30, fs: 11, split: true },
    { label: 'Manuf By',    field: 'sku.manufacturer_name',  h: 0.33, fs: 11, valueFs: 12 },
    { label: 'Address :',   field: 'sku.address_1',          h: 0.50, fs: 11, valueFs: 11, wrap: true, fullWidth: true },
    { label: 'Phone No.',   field: 'sku.customer_care_phone',h: 0.26, fs: 11, valueFs: 12 },
    { label: 'FSSAI No.',   field: 'sku.fssai_no',           h: 0.26, fs: 11, valueFs: 12 },
  ];

  let y = M;

  for (const row of rows) {
    const labelH = row.h;

    // Left label cell
    elements.push({
      id: newElementId(),
      type: 'text',
      x: M,
      y,
      width: LABEL_COL,
      height: labelH,
      rotation: 0,
      text_content: row.label,
      font_size: row.fs,
      font_weight: 'bold',
      text_align: 'left',
      color: '#000000',
    });

    if (row.split) {
      // "No of Pcs | 12 | Weight: | 7.60 Kg" — 4 cells
      const cellW = VALUE_W / 4;
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X, y, width: cellW, height: labelH, rotation: 0,
        data_field: 'sku.bottles_per_box',
        font_size: 13, font_weight: 'bold', text_align: 'left', color: '#000000',
      });
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X + cellW, y, width: cellW * 1.2, height: labelH, rotation: 0,
        text_content: 'Weight :',
        font_size: 11, font_weight: 'bold', text_align: 'left', color: '#000000',
      });
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X + cellW * 2.2, y, width: cellW * 1.8, height: labelH, rotation: 0,
        data_field: 'sku.gross_weight_kg',
        font_size: 13, font_weight: 'bold', text_align: 'left', color: '#000000',
      });
    } else {
      elements.push({
        id: newElementId(),
        type: 'text',
        x: VALUE_X,
        y,
        width: VALUE_W,
        height: labelH,
        rotation: 0,
        data_field: row.field,
        font_size: row.valueFs || 12,
        font_weight: 'bold',
        text_align: 'left',
        color: '#000000',
      });
    }

    y += labelH;
  }

  return {
    page_unit: 'inch',
    page_width: PAGE_W,
    page_height: PAGE_H,
    elements,
  };
}