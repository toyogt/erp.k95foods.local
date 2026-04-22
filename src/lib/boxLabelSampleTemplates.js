/**
 * Pre-built sample templates for the Box Label Builder.
 * Returns an elements array + page size that the builder can load.
 */
import { newElementId } from '@/lib/boxLabelHelpers';

/**
 * 4 x 6 inch (portrait) box label — matches reference image layout.
 * Coordinates stored in inches; font sizes in points.
 *
 * Layout: two-column table (label | value), bold black text throughout.
 * Row heights are tuned so total = 4 inch with small margins.
 */
export function build6x4SampleTemplate() {
  const PAGE_W = 4;     // inch (portrait)
  const PAGE_H = 6;     // inch (portrait)
  const M = 0.08;       // outer margin (inch)
  const LABEL_COL = 1.2;
  const VALUE_X = M + LABEL_COL;
  const VALUE_W = PAGE_W - M * 2 - LABEL_COL;

  const elements = [];

  // Rows — heights in inches, label font / value font sizes in points.
  // Row heights sum to ~5.84" (leaves margin top+bottom)
  const rows = [
    { label: 'Item Code',    field: 'sku.item_code',           h: 0.55, labelFs: 14, valueFs: 18 },
    { label: 'Item Name :',  field: 'sku.product_name',        h: 0.75, labelFs: 13, valueFs: 16 },
    { label: 'Batch No.',    field: 'job.batch_no',            h: 0.55, labelFs: 12, valueFs: 15 },
    { label: 'Manuf Date',   field: 'job.manufacturing_date',  h: 0.55, labelFs: 12, valueFs: 15 },
    { label: 'Expiry Date',  field: 'job.expiry_date',         h: 0.55, labelFs: 12, valueFs: 15 },
    { label: 'No of Pcs',    field: null,                      h: 0.55, labelFs: 12, split: true },
    { label: 'Manuf By',     field: 'sku.manufacturer_name',   h: 0.55, labelFs: 12, valueFs: 14 },
    { label: 'Address :',    field: 'sku.address_1',           h: 0.70, labelFs: 12, valueFs: 12 },
    { label: 'Phone No.',    field: 'sku.customer_care_phone', h: 0.50, labelFs: 12, valueFs: 13 },
    { label: 'FSSAI No.',    field: 'sku.fssai_no',            h: 0.50, labelFs: 12, valueFs: 13 },
  ];

  let y = M;

  for (const row of rows) {
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
      font_weight: 'bold',
      text_align: 'left',
      color: '#000000',
    });

    if (row.split) {
      // "[12]  Weight :  [7.60 Kg]"
      const cellW = VALUE_W / 4;
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X, y, width: cellW, height: row.h, rotation: 0,
        data_field: 'sku.bottles_per_box',
        font_size: 18, font_weight: 'bold', text_align: 'left', color: '#000000',
      });
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X + cellW, y, width: cellW * 1.2, height: row.h, rotation: 0,
        text_content: 'Weight :',
        font_size: 15, font_weight: 'bold', text_align: 'left', color: '#000000',
      });
      elements.push({
        id: newElementId(), type: 'text',
        x: VALUE_X + cellW * 2.2, y, width: cellW * 1.8, height: row.h, rotation: 0,
        data_field: 'sku.gross_weight_kg',
        font_size: 18, font_weight: 'bold', text_align: 'left', color: '#000000',
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
        font_weight: 'bold',
        text_align: 'left',
        color: '#000000',
      });
    }

    y += row.h;
  }

  return {
    page_unit: 'inch',
    page_width: PAGE_W,
    page_height: PAGE_H,
    elements,
  };
}