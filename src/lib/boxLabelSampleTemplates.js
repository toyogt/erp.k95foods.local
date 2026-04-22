/**
 * Pre-built sample templates for the Box Label Builder.
 * Returns an elements array + page size that the builder can load.
 */
import { newElementId } from '@/lib/boxLabelHelpers';

// 6 x 4 inch label, built in mm (152.4 x 101.6 mm)
// Layout: full-width rows, left label cell + right value cell, thick borders.
// Coordinates are in mm.
export function build6x4SampleTemplate() {
  const PAGE_W = 152.4;
  const PAGE_H = 101.6;

  // Row definitions (heights in mm)
  const rows = [
    { key: 'item_code',   h: 9,  label: 'Item Code',   field: 'sku.item_code',            labelCol: 30 },
    { key: 'item_name',   h: 16, label: 'Item Name :', field: 'sku.product_name',         labelCol: 30 },
    { key: 'batch',       h: 8,  label: 'Batch No.',   field: 'job.batch_no',             labelCol: 30 },
    { key: 'mfg',         h: 8,  label: 'Manuf Date',  field: 'job.manufacturing_date',   labelCol: 30 },
    { key: 'exp',         h: 8,  label: 'Expiry Date', field: 'job.expiry_date',          labelCol: 30 },
    { key: 'pcs_weight',  h: 8,  label: 'No of Pcs',   field: 'sku.bottles_per_box',      labelCol: 30, split: true },
    { key: 'manuf_by',    h: 9,  label: 'Manuf By',    field: 'sku.manufacturer_name',    labelCol: 30 },
    { key: 'address',     h: 12, label: 'Address :',   field: 'sku.address_1',            labelCol: 30 },
    { key: 'phone',       h: 7,  label: 'Phone No.',   field: 'sku.customer_care_phone',  labelCol: 30 },
    { key: 'fssai',       h: 7,  label: 'FSSAI No.',   field: 'sku.fssai_no',             labelCol: 30 },
  ];

  const MARGIN = 2;
  const elements = [];
  let y = MARGIN;

  for (const row of rows) {
    const labelX = MARGIN;
    const valueX = MARGIN + row.labelCol;
    const valueW = PAGE_W - MARGIN * 2 - row.labelCol;

    // Label cell (bold)
    elements.push({
      id: newElementId(),
      type: 'text',
      x: labelX,
      y,
      width: row.labelCol,
      height: row.h,
      rotation: 0,
      text_content: row.label,
      font_size: row.h > 10 ? 12 : 10,
      font_weight: 'bold',
      text_align: 'left',
      color: '#000000',
    });

    if (row.split) {
      // "No of Pcs" | value | "Weight :" | value — 4 cells in one row
      const cellW = valueW / 3; // value(pcs) | weight-label | weight-value
      // Pieces value
      elements.push({
        id: newElementId(),
        type: 'text',
        x: valueX,
        y,
        width: cellW,
        height: row.h,
        rotation: 0,
        data_field: 'sku.bottles_per_box',
        font_size: 11,
        font_weight: 'bold',
        text_align: 'left',
        color: '#000000',
      });
      // Weight label (static)
      elements.push({
        id: newElementId(),
        type: 'text',
        x: valueX + cellW,
        y,
        width: cellW,
        height: row.h,
        rotation: 0,
        text_content: 'Weight :',
        font_size: 10,
        font_weight: 'bold',
        text_align: 'left',
        color: '#000000',
      });
      // Weight value
      elements.push({
        id: newElementId(),
        type: 'text',
        x: valueX + cellW * 2,
        y,
        width: cellW,
        height: row.h,
        rotation: 0,
        data_field: 'sku.gross_weight_kg',
        font_size: 11,
        font_weight: 'bold',
        text_align: 'left',
        color: '#000000',
      });
    } else {
      // Normal value cell
      elements.push({
        id: newElementId(),
        type: 'text',
        x: valueX,
        y,
        width: valueW,
        height: row.h,
        rotation: 0,
        data_field: row.field,
        font_size: row.h > 12 ? 12 : 11,
        font_weight: 'bold',
        text_align: 'left',
        color: '#000000',
      });
    }

    y += row.h;
  }

  // Barcode row at bottom
  const remaining = PAGE_H - y - MARGIN;
  if (remaining > 6) {
    elements.push({
      id: newElementId(),
      type: 'barcode',
      x: MARGIN,
      y: y + 1,
      width: PAGE_W - MARGIN * 2,
      height: Math.max(8, remaining - 2),
      rotation: 0,
      data_field: 'sku.box_barcode',
      barcode_type: 'CODE128',
      color: '#000000',
    });
  }

  return {
    page_unit: 'inch',
    page_width: 6,
    page_height: 4,
    elements,
  };
}