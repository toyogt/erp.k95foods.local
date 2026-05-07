/**
 * buildRynanLabelData.js
 *
 * Converts the SKU's POD field mapping config (from SKUPrintMapping.payload_map_json)
 * into the `label_data` object expected by the Rynan printer middleware.
 *
 * The mapping config is an array of:
 *   { pod_field: 'POD4', erp_source: 'batch_no', label: 'Batch Number', is_editable: true }
 *
 * The erp_source keys match keys returned by computeLabelFields() PLUS extras from
 * the job/product record (product_name, sku_code, fssai_no, manufacturer_name, quantity).
 *
 * If no mapping config is provided (null / empty array), falls back to the legacy
 * hardcoded POD1–POD12 defaults so existing jobs continue to work.
 */

import { computeLabelFields } from './labelFieldComputer';

/**
 * Map from PODFieldMappingEditor ERP source keys → computeLabelFields() output keys.
 * Keys not in computeLabelFields are pulled from the `extraFields` argument.
 */
const ERP_SOURCE_TO_COMPUTED_KEY = {
  mrp:                'mrp',
  mrp_with_usp:       'mrpWithUsp',
  tax_line:           'taxLine',
  batch_no:           'batchNo',
  manufacturing_date: 'mfgDate',
  expiry_date:        'expiryDate',
  usp:                'usp',
  mfg_date_offset:    'mfgDateOffset',
  expiry_date_offset: 'expiryDateOffset',
  net_weight:         'netWeight',
  usp_with_unit:      'uspWithUnit',
  mrp_and_usp:        'mrpAndUsp',
  // Extra fields supplied from job / product master directly
  product_name:       'productName',
  sku_code:           'skuCode',
  fssai_no:           'fssaiNo',
  manufacturer_name:  'manufacturerName',
  quantity:           'quantity',
};

/**
 * Build the Rynan `label_data` payload from:
 *
 * @param {object} params
 * @param {Array}  params.podMappings     - Array of { pod_field, erp_source, is_editable } from SKUPrintMapping.payload_map_json
 * @param {object} params.computedFields  - Output of computeLabelFields()
 * @param {object} params.extraFields     - Extra job/product fields: { skuCode, fssaiNo, manufacturerName, quantity }
 * @param {object} [params.operatorOverrides] - Optional manual values keyed by pod_field (e.g. { POD4: 'CUSTOM_BATCH' })
 *
 * @returns {{ label_data: object, hasManualFields: boolean, manualFields: string[] }}
 */
export function buildRynanLabelData({ podMappings, computedFields, extraFields = {}, operatorOverrides = {} }) {
  // ── Merge all resolved field values ───────────────────────────────────
  const allValues = {
    ...computedFields,
    skuCode: extraFields.skuCode || '',
    fssaiNo: extraFields.fssaiNo || '',
    manufacturerName: extraFields.manufacturerName || '',
    quantity: extraFields.quantity != null ? String(extraFields.quantity) : '',
  };

  // ── Build label_data from pod mappings ─────────────────────────────────
  if (podMappings && podMappings.length > 0) {
    const label_data = {};
    const manualFields = [];

    for (const row of podMappings) {
      if (!row.pod_field) continue;

      // Operator override takes highest priority
      if (operatorOverrides[row.pod_field] !== undefined) {
        label_data[row.pod_field] = operatorOverrides[row.pod_field];
        continue;
      }

      // Manual entry — leave empty so operator fills it on the printer app
      if (row.erp_source === 'manual' || !row.erp_source) {
        label_data[row.pod_field] = '';
        manualFields.push(row.pod_field);
        continue;
      }

      // Resolve ERP source → computed value
      const computedKey = ERP_SOURCE_TO_COMPUTED_KEY[row.erp_source];
      const resolvedValue = computedKey ? (allValues[computedKey] ?? '') : '';
      label_data[row.pod_field] = resolvedValue;
    }

    return {
      label_data,
      hasManualFields: manualFields.length > 0,
      manualFields,
    };
  }

  // ── Fallback: legacy hardcoded POD1-POD12 ─────────────────────────────
  // Used when no POD mapping is configured on the SKU yet.
  return {
    label_data: {
      POD1:  computedFields.mrp          || '',
      POD2:  computedFields.mrpWithUsp   || '',
      POD3:  computedFields.taxLine      || '',
      POD4:  computedFields.batchNo      || '',
      POD5:  computedFields.mfgDate      || '',
      POD6:  computedFields.expiryDate   || '',
      POD7:  computedFields.usp          || '',
      POD8:  computedFields.mfgDateOffset  || '',
      POD9:  computedFields.expiryDateOffset || '',
      POD10: computedFields.netWeight    || '',
      POD11: computedFields.uspWithUnit  || '',
      POD12: computedFields.mrpAndUsp    || '',
      // Legacy keys for backward compat with older middleware builds
      batch_no:     computedFields.batchNo      || '',
      mfg_date:     computedFields.mfgDate      || '',
      exp_date:     computedFields.expiryDate   || '',
      mrp:          computedFields.mrp          || '',
      usp:          computedFields.usp          || '',
      product_name: computedFields.productName  || '',
      sku_code:     extraFields.skuCode         || '',
    },
    hasManualFields: false,
    manualFields: [],
  };
}

/**
 * High-level helper used by LblDemoPrintStep and LblBulkPrintStep.
 *
 * Fetches the SKU's POD mapping config and computes the final label_data
 * object ready to be embedded in the Rynan print command.
 *
 * @param {object} params
 * @param {object} params.job            - LabellingJob record
 * @param {object} params.productMaster  - ProductMaster record for the SKU
 * @param {object} params.labelInputs    - { mrp, mfg_date, batch_no } from operator inputs
 * @param {Array}  params.skuPodMappings - payload_map_json parsed array from SKUPrintMapping
 * @param {object} [params.operatorOverrides] - Optional manual overrides by POD field
 *
 * @returns {{ label_data, hasManualFields, manualFields, computedFields }}
 */
export function resolveDemoPrintLabelData({ job, productMaster, labelInputs, skuPodMappings, operatorOverrides = {} }) {
  const computedFields = computeLabelFields({
    mrp:          labelInputs.mrp,
    mlPerBottle:  productMaster?.ml_per_bottle,
    mfgDate:      labelInputs.mfg_date,
    labellingDate: job?.labelling_date || '',
    shelfLifeDays: productMaster?.shelf_life_days,
    batchNo:       labelInputs.batch_no,
    productName:   job?.product_name,
  });

  const extraFields = {
    skuCode:          job?.sku_code         || '',
    fssaiNo:          productMaster?.fssai_no         || '',
    manufacturerName: productMaster?.manufacturer_name || '',
    quantity:         job?.quantity_bottles_planned    || '',
  };

  const { label_data, hasManualFields, manualFields } = buildRynanLabelData({
    podMappings: skuPodMappings,
    computedFields,
    extraFields,
    operatorOverrides,
  });

  return { label_data, hasManualFields, manualFields, computedFields };
}