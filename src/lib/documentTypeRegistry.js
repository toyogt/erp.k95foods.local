/**
 * Document Type Registry
 * Centralized configuration for document types used in approvals
 * Can be overridden by AppSetting entity for runtime customization
 */

import { base44 } from '@/api/base44Client';

// Default document types (fallback)
const DEFAULT_DOC_TYPES = [
  { value: 'PurchaseRequest', label: 'Material Request (MR)' },
  { value: 'PurchaseOrder', label: 'Purchase Order (PO)' },
  { value: 'GRNHeader', label: 'Goods Receipt (GRN)' },
  { value: 'QCInspection', label: 'Quality Control (QC)' },
  { value: 'SupplierInvoice', label: 'Supplier Invoice' },
  { value: 'PaymentRequest', label: 'Payment Request' },
  { value: 'BoxLabel', label: 'Box Label' },
];

let cachedDocTypes = null;
let cacheExpiry = null;

/**
 * Get document types from AppSetting or fallback to defaults
 * Cache for 5 minutes to reduce DB queries
 */
export async function getDocumentTypes() {
  const now = Date.now();
  
  // Return cached if still fresh
  if (cachedDocTypes && cacheExpiry && cacheExpiry > now) {
    return cachedDocTypes;
  }

  try {
    // Try to fetch from AppSetting
    const setting = await base44.entities.AppSetting.filter({ 
      setting_key: 'document_types' 
    });
    
    if (setting?.[0]?.setting_value && Array.isArray(setting[0].setting_value)) {
      cachedDocTypes = setting[0].setting_value;
      cacheExpiry = now + (5 * 60 * 1000); // 5 minute cache
      return cachedDocTypes;
    }
  } catch (e) {
    console.warn('Failed to fetch document types from AppSetting:', e);
  }

  // Fallback to defaults
  cachedDocTypes = DEFAULT_DOC_TYPES;
  cacheExpiry = now + (5 * 60 * 1000);
  return DEFAULT_DOC_TYPES;
}

/**
 * Clear the document types cache
 * Call this after updating the AppSetting
 */
export function clearDocTypeCache() {
  cachedDocTypes = null;
  cacheExpiry = null;
}

/**
 * Get label for a document type
 */
export async function getDocTypeLabel(docTypeValue) {
  const types = await getDocumentTypes();
  return types.find(t => t.value === docTypeValue)?.label || docTypeValue;
}