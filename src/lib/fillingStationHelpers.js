/**
 * Filling Station Helpers
 * Utilities and constants
 */

export const CRATE_STATUSES = {
  FILLED: 'Filled',
  IN_CHAMBER: 'In Chamber',
  POST_CHAMBER: 'Post-Chamber',
  RECEIVED: 'Received',
  STORED: 'Stored',
};

export function formatCrateCode(batchId, sequence) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `CR_${date}_${batchId.substring(0, 4)}_${String(sequence).padStart(4, '0')}`;
}

export function calculateFillRate(currentCrates, targetQty) {
  const totalFilled = currentCrates.reduce((sum, c) => sum + (c.bottle_count || 0), 0);
  if (targetQty === 0) return 0;
  return (totalFilled / targetQty) * 100;
}

export function getProductionStatus(crates, targetQty, variance = 5) {
  const filled = crates.reduce((sum, c) => sum + (c.bottle_count || 0), 0);
  const diff = Math.abs(filled - targetQty) / targetQty * 100;

  if (diff < variance) return 'on_target';
  if (filled < targetQty) return 'behind';
  return 'ahead';
}

export const BATCH_STATUSES = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  FILLING_COMPLETE: 'Filling Complete',
  QC_PENDING: 'QC Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};