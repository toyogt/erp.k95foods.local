// Canonical list of cost heads used across all logistics cost panels
export const COST_HEADS = [
  { key: 'freight',       label: 'Freight' },
  { key: 'door_delivery', label: 'Door Delivery' },
  { key: 'bilty',         label: 'Bilty' },
  { key: 'labour',        label: 'Labour Charge' },
  { key: 'pickup',        label: 'Pickup Charges' },
  { key: 'late_fees',     label: 'Late Fees' },
];

// Prefix a cost head key with a source prefix (system_, planned_, actual_)
export function prefixKey(prefix, key) {
  return `${prefix}_${key}`;
}

// Sum all cost head values for a given prefix from a record
export function sumCostHeads(record, prefix) {
  return COST_HEADS.reduce((total, h) => total + (Number(record?.[prefixKey(prefix, h.key)]) || 0), 0);
}