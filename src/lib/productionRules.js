/**
 * Production Business Rules
 * Validation and constraints
 */

export function checkProductionRules(order) {
  const errors = [];

  if (!order.sku) {
    errors.push('Product Code required');
  }

  if (!order.target_bottles || order.target_bottles <= 0) {
    errors.push('Target quantity must be > 0');
  }

  if (!order.assigned_line || (order.assigned_line !== 1 && order.assigned_line !== 2)) {
    errors.push('Assign to Line 1 or Line 2');
  }

  if (!order.pack_type) {
    errors.push('Pack type required');
  }

  return errors;
}

export function checkFillingBatch(batch) {
  if (batch.status !== 'APPROVED') {
    return 'Batch must be approved before filling';
  }
  return null;
}

export function validateCrateInput(crateData, batch) {
  if (!crateData.crate_id) {
    return 'Crate ID required';
  }

  if (!crateData.bottle_count || crateData.bottle_count <= 0) {
    return 'Bottle count must be > 0';
  }

  if (crateData.bottle_count > 100) {
    return 'Bottle count seems too high';
  }

  return null;
}

export function isProductionComplete(batch, crates) {
  const totalBottles = crates.reduce((sum, c) => sum + (c.bottle_count || 0), 0);
  const targetBottles = batch.planned_qty_liters || 0;

  // Allow 5% variance
  const variance = Math.abs(totalBottles - targetBottles) / targetBottles;
  return variance < 0.05;
}