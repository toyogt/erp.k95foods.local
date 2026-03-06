/**
 * stockLedger.js
 * Atomic helpers for updating StockBalance and creating StockMovement records.
 */
import { base44 } from '@/api/base44Client';

function genMoveId() {
  return `MOV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}

/**
 * Adjust StockBalance for a single sku+bin by delta (positive or negative).
 * Creates the record if it doesn't exist.
 */
async function adjustBalance(skuCode, binId, binCode, delta) {
  const existing = await base44.entities.StockBalance.filter({ sku_code: skuCode, bin_id: binId });
  if (existing.length) {
    const current = existing[0];
    await base44.entities.StockBalance.update(current.id, {
      qty: (current.qty || 0) + delta,
      last_updated_at: new Date().toISOString(),
    });
  } else {
    await base44.entities.StockBalance.create({
      sku_code: skuCode,
      bin_id: binId,
      bin_code: binCode || '',
      qty: delta,
      last_updated_at: new Date().toISOString(),
    });
  }
}

/**
 * Record a stock movement + update balances.
 * @param {object} params
 */
export async function recordMovement({ moveType, refType, refId, skuCode, qty, fromBinId, fromBinCode, toBinId, toBinCode, performedBy, notes }) {
  const move_id = genMoveId();
  await base44.entities.StockMovement.create({
    move_id,
    timestamp: new Date().toISOString(),
    move_type: moveType,
    reference_type: refType || '',
    reference_id: refId || '',
    sku_code: skuCode,
    qty,
    from_bin_id: fromBinId || '',
    to_bin_id: toBinId || '',
    performed_by: performedBy || '',
    notes: notes || '',
  });

  if (toBinId) await adjustBalance(skuCode, toBinId, toBinCode, qty);
  if (fromBinId) await adjustBalance(skuCode, fromBinId, fromBinCode, -qty);

  return move_id;
}

/**
 * Get the configured bin for a workflow purpose (QC_HOLD, RECEIVING, REJECTED, DEFAULT_PUTAWAY).
 */
export async function getWorkflowBin(purpose) {
  const configs = await base44.entities.WorkflowBinConfig.filter({ purpose, is_active: true });
  if (!configs.length) return null;
  const bins = await base44.entities.Bin.filter({ bin_id: configs[0].bin_id });
  return bins[0] || null;
}

/**
 * Post all GRN items into QC_HOLD bin.
 * Called when GRN status changes to SUBMITTED_TO_QC.
 */
export async function postGRNtoQCHold(grn, grnItems, performedBy) {
  const qcBin = await getWorkflowBin('QC_HOLD');
  if (!qcBin) throw new Error('QC_HOLD bin not configured. Go to Warehouses & Bins to set it up.');

  await Promise.all(grnItems.map(item =>
    recordMovement({
      moveType: 'GRN_IN',
      refType: 'GRN',
      refId: grn.grn_id,
      skuCode: item.item_code,
      qty: item.received_qty || 0,
      toBinId: qcBin.bin_id,
      toBinCode: qcBin.bin_code,
      performedBy,
      notes: `GRN ${grn.grn_id} received`,
    })
  ));
}

/**
 * Move stock from QC_HOLD to target bin (PASS -> RECEIVING/DEFAULT_PUTAWAY, FAIL -> REJECTED).
 */
export async function moveAfterQC(qcItems, qcId, fromBin, toBin, moveType, performedBy) {
  await Promise.all(qcItems.map(item =>
    recordMovement({
      moveType,
      refType: 'QC',
      refId: qcId,
      skuCode: item.sku_code,
      qty: item.received_qty || item.sample_qty || 0,
      fromBinId: fromBin.bin_id,
      fromBinCode: fromBin.bin_code,
      toBinId: toBin.bin_id,
      toBinCode: toBin.bin_code,
      performedBy,
      notes: `QC ${qcId} result: ${item.result}`,
    })
  ));
}