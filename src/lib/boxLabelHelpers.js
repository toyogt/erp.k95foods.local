/**
 * Box Label Template Helpers
 * Defines available dynamic data fields and element/value resolution utilities.
 */

// Master list of dynamic data fields usable in templates.
// `key` is what gets stored; `label` is shown to the user in the builder.
export const DATA_FIELDS = [
  { key: 'job.batch_no',              label: 'Batch Number'         },
  { key: 'job.manufacturing_date',    label: 'Manufacturing Date'   },
  { key: 'job.labelling_date',        label: 'Labelling Date'       },
  { key: 'job.quantity_bottles_planned', label: 'Planned Bottles'   },
  { key: 'job.product_name',          label: 'Job Product Name'     },
  { key: 'job.sku_code',              label: 'Job SKU Code'         },
  { key: 'job.mrp',                   label: 'Job MRP'              },
  { key: 'job.bottle_type',           label: 'Bottle Type'          },

  { key: 'sku.product_name',          label: 'SKU Product Name'     },
  { key: 'sku.item_code',             label: 'SKU Item Code'        },
  { key: 'sku.brand_name',            label: 'Brand'                },
  { key: 'sku.flavour',               label: 'Flavour'              },
  { key: 'sku.mrp',                   label: 'SKU MRP (Bottle)'     },
  { key: 'sku.mrp_box',               label: 'SKU MRP (Box)'        },
  { key: 'sku.bottles_per_box',       label: 'Bottles per Box'      },
  { key: 'sku.ml_per_bottle',         label: 'Volume per Bottle'    },
  { key: 'sku.fssai_no',              label: 'FSSAI Number'         },
  { key: 'sku.hsn_code',              label: 'HSN Code'             },
  { key: 'sku.manufacturer_name',     label: 'Manufacturer'         },
  { key: 'sku.address_1',             label: 'Address Line 1'       },
  { key: 'sku.address_2',             label: 'Address Line 2'       },
  { key: 'sku.customer_care_email',   label: 'Customer Care Email'  },
  { key: 'sku.customer_care_phone',   label: 'Customer Care Phone'  },
  { key: 'sku.product_barcode',       label: 'Product Barcode'      },
  { key: 'sku.box_barcode',           label: 'Box Barcode'          },
  { key: 'sku.gross_weight_kg',       label: 'Gross Weight (Box)'   },

  // Computed / derived fields — resolved at print time
  { key: 'computed.gross_weight',     label: 'Computed Box Weight (e.g. "7.60 Kg")' },
  { key: 'computed.full_address',     label: 'Address 1 + Address 2' },
];

/**
 * Resolve dot path like 'sku.product_name' against a data object { job, sku }.
 */
export function resolveField(path, data) {
  if (!path) return '';
  const parts = path.split('.');
  let cur = data;
  for (const p of parts) {
    if (cur == null) return '';
    cur = cur[p];
  }
  if (cur == null) return '';
  return String(cur);
}

/**
 * Render a text template with {{path}} placeholders against data = { job, sku }.
 */
export function renderTemplateText(text, data) {
  if (!text) return '';
  return text.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, path) => resolveField(path, data));
}

/**
 * Compute the resolved string for an element (either data_field or text_content).
 */
export function resolveElementValue(element, data) {
  if (element.data_field) return resolveField(element.data_field, data);
  return renderTemplateText(element.text_content || '', data);
}

/**
 * Generate a new element id.
 */
export function newElementId() {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Generate a default template_id.
 */
export function generateTemplateId() {
  return `BLT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Convert page_unit to pixels at a given ppi for screen preview.
 * 1 inch = 96 px (CSS), 1 mm = 3.7795275591 px.
 */
export function unitToPx(value, unit) {
  if (unit === 'inch') return value * 96;
  return value * 3.7795275591;
}

export function pxToUnit(px, unit) {
  if (unit === 'inch') return px / 96;
  return px / 3.7795275591;
}

/**
 * Default element templates when user adds a new element on the canvas.
 */
export function buildDefaultElement(type) {
  const base = {
    id: newElementId(),
    type,
    x: 5,
    y: 5,
    width: 40,
    height: 10,
    rotation: 0,
  };
  if (type === 'text') {
    return { ...base, text_content: 'Text', font_size: 10, font_weight: 'normal', text_align: 'left', color: '#000000' };
  }
  if (type === 'image') {
    return { ...base, width: 30, height: 30, image_url: '' };
  }
  if (type === 'barcode') {
    return { ...base, width: 50, height: 15, data_field: 'job.batch_no', barcode_type: 'CODE128', color: '#000000' };
  }
  return base;
}