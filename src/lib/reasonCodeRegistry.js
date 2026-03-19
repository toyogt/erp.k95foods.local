/**
 * Central Reason Code Registry
 * Standardized codes for why actions occur
 */

export const REASON_CODE_REGISTRY = {
  // Stock adjustments
  STOCK_ADJUSTMENT: {
    PHYSICAL_COUNT: { key: 'PHYSICAL_COUNT', label: 'Physical Count Variance', category: 'adjustment' },
    SPILLAGE: { key: 'SPILLAGE', label: 'Spillage/Damage', category: 'adjustment' },
    EVAPORATION: { key: 'EVAPORATION', label: 'Evaporation Loss', category: 'adjustment' },
    SYSTEM_ERROR: { key: 'SYSTEM_ERROR', label: 'System Error Correction', category: 'adjustment' },
    TRANSFER_VARIANCE: { key: 'TRANSFER_VARIANCE', label: 'Transfer Variance', category: 'adjustment' },
    RECONCILIATION: { key: 'RECONCILIATION', label: 'Monthly Reconciliation', category: 'adjustment' },
    MANUAL_CORRECTION: { key: 'MANUAL_CORRECTION', label: 'Manual Correction', category: 'adjustment' },
  },

  // Rework & rejection
  REWORK: {
    QUALITY_ISSUE: { key: 'QUALITY_ISSUE', label: 'Quality Issue Detected', category: 'rework' },
    LABELLING_ERROR: { key: 'LABELLING_ERROR', label: 'Labelling Error', category: 'rework' },
    BATCH_MIX_UP: { key: 'BATCH_MIX_UP', label: 'Batch Mix-up', category: 'rework' },
    PACKAGING_DAMAGE: { key: 'PACKAGING_DAMAGE', label: 'Packaging Damaged', category: 'rework' },
    CUSTOMER_COMPLAINT: { key: 'CUSTOMER_COMPLAINT', label: 'Customer Complaint', category: 'rework' },
    INCOMPLETE_FILLING: { key: 'INCOMPLETE_FILLING', label: 'Incomplete Filling', category: 'rework' },
  },

  // Rejection reasons
  REJECTION: {
    FAILED_QC: { key: 'FAILED_QC', label: 'Failed Quality Control', category: 'rejection' },
    OUT_OF_SPEC: { key: 'OUT_OF_SPEC', label: 'Out of Specification', category: 'rejection' },
    EXPIRED: { key: 'EXPIRED', label: 'Expired/Shelf Life', category: 'rejection' },
    CONTAMINATION: { key: 'CONTAMINATION', label: 'Contamination Detected', category: 'rejection' },
    SUPPLIER_DEFECT: { key: 'SUPPLIER_DEFECT', label: 'Supplier Defect', category: 'rejection' },
    SHORT_WEIGHT: { key: 'SHORT_WEIGHT', label: 'Short Weight/Quantity', category: 'rejection' },
    WRONG_SPECIFICATION: { key: 'WRONG_SPECIFICATION', label: 'Wrong Specification', category: 'rejection' },
  },

  // Relabelling
  RELABEL: {
    EXPIRY_UPDATE: { key: 'EXPIRY_UPDATE', label: 'Expiry Date Update', category: 'relabel' },
    BARCODE_ERROR: { key: 'BARCODE_ERROR', label: 'Barcode Error Correction', category: 'relabel' },
    PRODUCT_CODE_CHANGE: { key: 'PRODUCT_CODE_CHANGE', label: 'Product Code Change', category: 'relabel' },
    BATCH_CORRECTION: { key: 'BATCH_CORRECTION', label: 'Batch ID Correction', category: 'relabel' },
    QUALITY_STAMP: { key: 'QUALITY_STAMP', label: 'Quality Stamp Addition', category: 'relabel' },
  },

  // Printing/reprinting
  REPRINT: {
    QUALITY_ISSUE: { key: 'QUALITY_ISSUE', label: 'Print Quality Issue', category: 'reprint' },
    SMUDGE: { key: 'SMUDGE', label: 'Smudged/Illegible', category: 'reprint' },
    DAMAGE: { key: 'DAMAGE', label: 'Label Damage', category: 'reprint' },
    WRONG_DATA: { key: 'WRONG_DATA', label: 'Wrong Data Printed', category: 'reprint' },
    LOST_LABEL: { key: 'LOST_LABEL', label: 'Lost/Missing Label', category: 'reprint' },
    CUSTOMER_REQUEST: { key: 'CUSTOMER_REQUEST', label: 'Customer Request', category: 'reprint' },
  },

  // Override actions
  OVERRIDE: {
    EMERGENCY: { key: 'EMERGENCY', label: 'Emergency Override', category: 'override' },
    SUPERVISOR_APPROVAL: { key: 'SUPERVISOR_APPROVAL', label: 'Supervisor Approval', category: 'override' },
    EXCEPTION_HANDLING: { key: 'EXCEPTION_HANDLING', label: 'Exception Handling', category: 'override' },
    BUSINESS_REQUIREMENT: { key: 'BUSINESS_REQUIREMENT', label: 'Business Requirement', category: 'override' },
    CUSTOMER_SPECIAL_REQUEST: { key: 'CUSTOMER_SPECIAL_REQUEST', label: 'Customer Special Request', category: 'override' },
    REGULATORY_REQUIREMENT: { key: 'REGULATORY_REQUIREMENT', label: 'Regulatory Requirement', category: 'override' },
  },

  // Receipt discrepancies
  SHORT_RECEIPT: {
    SHORT_DELIVERY: { key: 'SHORT_DELIVERY', label: 'Short Delivery from Supplier', category: 'receipt' },
    DAMAGED_IN_TRANSIT: { key: 'DAMAGED_IN_TRANSIT', label: 'Damaged in Transit', category: 'receipt' },
    WRONG_ITEM: { key: 'WRONG_ITEM', label: 'Wrong Item Received', category: 'receipt' },
    QUANTITY_MISMATCH: { key: 'QUANTITY_MISMATCH', label: 'Quantity Mismatch', category: 'receipt' },
    PACKAGING_ISSUE: { key: 'PACKAGING_ISSUE', label: 'Packaging Issue', category: 'receipt' },
  },

  // Dispatch variance
  DISPATCH_VARIANCE: {
    STOCK_UNAVAILABLE: { key: 'STOCK_UNAVAILABLE', label: 'Stock Unavailable', category: 'dispatch' },
    PARTIAL_DISPATCH: { key: 'PARTIAL_DISPATCH', label: 'Partial Dispatch', category: 'dispatch' },
    QUALITY_HOLD: { key: 'QUALITY_HOLD', label: 'Quality Hold', category: 'dispatch' },
    DELAY_REQUEST: { key: 'DELAY_REQUEST', label: 'Customer Delay Request', category: 'dispatch' },
    PRODUCTION_DELAY: { key: 'PRODUCTION_DELAY', label: 'Production Delay', category: 'dispatch' },
    LOGISTICS_CONSTRAINT: { key: 'LOGISTICS_CONSTRAINT', label: 'Logistics Constraint', category: 'dispatch' },
  },

  // General
  GENERAL: {
    MANUAL_CORRECTION: { key: 'MANUAL_CORRECTION', label: 'Manual Correction', category: 'general' },
    DATA_ENTRY_ERROR: { key: 'DATA_ENTRY_ERROR', label: 'Data Entry Error', category: 'general' },
    SYSTEM_CORRECTION: { key: 'SYSTEM_CORRECTION', label: 'System Correction', category: 'general' },
    TEST_ENTRY: { key: 'TEST_ENTRY', label: 'Test Entry', category: 'general' },
    OTHER: { key: 'OTHER', label: 'Other (See Notes)', category: 'general' },
  },
};

/**
 * Get reason code details
 */
export function getReasonCode(category, key) {
  return REASON_CODE_REGISTRY[category]?.[key] || { key, label: key, category };
}

/**
 * Get all reason codes for a category
 */
export function getReasonCodesByCategory(category) {
  return Object.values(REASON_CODE_REGISTRY[category] || {});
}

/**
 * Get reason code label
 */
export function getReasonCodeLabel(category, key) {
  return getReasonCode(category, key).label;
}

/**
 * Check if reason code is mandatory for action
 */
export function isReasonCodeMandatory(actionType, entityType) {
  const criticalActions = [
    'adjustment',
    'rework',
    'reject',
    'override',
    'delete'
  ];
  
  const criticalEntities = [
    'Batch',
    'Pallet',
    'Dispatch',
    'GRNHeader',
    'StockBalance'
  ];

  return criticalActions.includes(actionType) || criticalEntities.includes(entityType);
}

/**
 * Get appropriate reason codes for an action
 */
export function getReasonCodesForAction(actionType) {
  const mapping = {
    'adjustment': REASON_CODE_REGISTRY.STOCK_ADJUSTMENT,
    'rework': REASON_CODE_REGISTRY.REWORK,
    'reject': REASON_CODE_REGISTRY.REJECTION,
    'relabel': REASON_CODE_REGISTRY.RELABEL,
    'reprint': REASON_CODE_REGISTRY.REPRINT,
    'override': REASON_CODE_REGISTRY.OVERRIDE,
    'short_receipt': REASON_CODE_REGISTRY.SHORT_RECEIPT,
    'dispatch_variance': REASON_CODE_REGISTRY.DISPATCH_VARIANCE,
  };
  
  return mapping[actionType] || REASON_CODE_REGISTRY.GENERAL;
}