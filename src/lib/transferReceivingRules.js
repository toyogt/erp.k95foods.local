/**
 * Transfer Receiving Business Rules
 * Validation and business logic
 */

export function checkTransferRules(transfer) {
  const errors = [];

  if (!transfer.source_warehouse) {
    errors.push('Source warehouse required');
  }

  if (!transfer.destination_warehouse) {
    errors.push('Destination warehouse required');
  }

  if (transfer.source_warehouse === transfer.destination_warehouse) {
    errors.push('Source and destination cannot be the same');
  }

  if (!transfer.lines || transfer.lines.length === 0) {
    errors.push('Add at least one line item');
  }

  return errors;
}

export function validateReceiveQty(receivedQty, expectedQty) {
  if (receivedQty === null || receivedQty === undefined) {
    return 'Received quantity required';
  }

  const recvNum = parseFloat(receivedQty);
  const expNum = parseFloat(expectedQty);

  if (isNaN(recvNum) || recvNum < 0) {
    return 'Quantity must be a valid positive number';
  }

  if (recvNum > expNum * 1.05) {
    // Allow 5% overage
    return `Cannot receive more than 105% of expected (max ${(expNum * 1.05).toFixed(2)})`;
  }

  return null;
}

export function calculateVariance(expectedQty, receivedQty) {
  if (expectedQty === 0) return 0;
  return Math.abs(expectedQty - receivedQty) / expectedQty * 100;
}

export function getVarianceSeverity(variance) {
  if (variance > 10) return 'critical';
  if (variance > 5) return 'high';
  if (variance > 2) return 'medium';
  return 'low';
}