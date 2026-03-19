/**
 * Transfer Receiving Helpers
 * Utility functions and constants
 */

export const TRANSFER_STATUSES = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export const TRANSFER_STATUS_COLORS = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function formatTransferCode(prefix, timestamp) {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const randomId = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}_${dateStr}_${randomId}`;
}

export function calculateTransferSummary(lines) {
  if (!lines || lines.length === 0) {
    return {
      totalItems: 0,
      totalQty: 0,
      completeLines: 0,
    };
  }

  return {
    totalItems: lines.length,
    totalQty: lines.reduce((sum, line) => sum + (line.qty || 0), 0),
    completeLines: lines.filter(line => line.received_qty !== null).length,
  };
}

export function getLineStatus(expectedQty, receivedQty) {
  if (receivedQty === null || receivedQty === undefined) return 'pending';
  if (receivedQty === 0) return 'not_received';
  if (Math.abs(expectedQty - receivedQty) < 0.01) return 'exact';
  if (receivedQty < expectedQty) return 'short';
  return 'over';
}

export const VARIANCE_MESSAGES = {
  exact: 'Quantity matches',
  short: 'Quantity short',
  over: 'Quantity over',
  not_received: 'Not received',
  pending: 'Awaiting receipt',
};