/**
 * Trace Event Helper
 * Simplifies firing trace events from pages
 */

import { base44 } from '@/api/base44Client';

/**
 * Fire a trace event
 * Call this whenever material/product moves through factory workflow
 */
export async function fireTraceEvent({
  eventType,
  module,
  site = 'site_001',
  sourceType,
  sourceId,
  targetType,
  targetId,
  quantity = null,
  unit = null,
  batchId = null,
  lotId = null,
  crateId = null,
  palletId = null,
  dispatchId = null,
  sku = null,
  productName = null,
  sessionId = null,
  orderId = null,
  user = null,
  device = 'unknown',
  remarks = null,
  yieldLoss = 0,
  lossReason = null,
  isCritical = false,
}) {
  try {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const event = {
      event_id: eventId,
      event_type: eventType,
      module,
      site_id: site,
      timestamp: new Date().toISOString(),
      source_entity_type: sourceType,
      source_entity_id: sourceId,
      target_entity_type: targetType,
      target_entity_id: targetId,
      quantity,
      unit,
      batch_id: batchId,
      lot_id: lotId,
      crate_id: crateId,
      pallet_id: palletId,
      dispatch_id: dispatchId,
      sku,
      product_name: productName,
      session_id: sessionId,
      order_id: orderId,
      user_email: user?.email,
      user_name: user?.full_name,
      device_id: device,
      remarks,
      yield_loss: yieldLoss,
      loss_reason: lossReason,
      is_critical: isCritical,
    };

    const result = await base44.entities.TraceEvent.create(event);
    return { success: true, eventId: result.id };
  } catch (error) {
    console.error('Failed to fire trace event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fire event when raw material arrives
 */
export async function fireRMInward({
  lotId,
  itemCode,
  quantity,
  unit,
  user,
  device,
  remarks,
}) {
  return fireTraceEvent({
    eventType: 'RM_INWARD',
    module: 'WAREHOUSE',
    sourceType: 'Supplier',
    sourceId: 'external',
    targetType: 'Lot',
    targetId: lotId,
    lotId,
    quantity,
    unit,
    user,
    device,
    remarks,
  });
}

/**
 * Fire event when QC releases material
 */
export async function fireQCRelease({
  lotId,
  user,
  device,
  remarks,
}) {
  return fireTraceEvent({
    eventType: 'QC_RELEASE',
    module: 'QUALITY',
    sourceType: 'Lot',
    sourceId: lotId,
    targetType: 'Lot',
    targetId: lotId,
    lotId,
    isCritical: false,
    user,
    device,
    remarks,
  });
}

/**
 * Fire event when QC rejects material
 */
export async function fireQCReject({
  lotId,
  quantity,
  unit,
  reason,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'QC_REJECT',
    module: 'QUALITY',
    sourceType: 'Lot',
    sourceId: lotId,
    targetType: 'Lot',
    targetId: lotId,
    lotId,
    yieldLoss: quantity,
    unit,
    lossReason: reason,
    isCritical: true,
    user,
    device,
  });
}

/**
 * Fire event when material is issued to batch
 */
export async function fireIssueToBatch({
  lotId,
  batchId,
  quantity,
  unit,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'ISSUE_TO_BATCH',
    module: 'PRODUCTION',
    sourceType: 'Lot',
    sourceId: lotId,
    targetType: 'Batch',
    targetId: batchId,
    lotId,
    batchId,
    quantity,
    unit,
    user,
    device,
  });
}

/**
 * Fire event when batch is created
 */
export async function fireBatchCreation({
  batchId,
  sku,
  productName,
  quantity,
  unit,
  user,
  device,
  remarks,
}) {
  return fireTraceEvent({
    eventType: 'BATCH_CREATION',
    module: 'PRODUCTION',
    sourceType: 'Order',
    sourceId: 'system',
    targetType: 'Batch',
    targetId: batchId,
    batchId,
    sku,
    productName,
    quantity,
    unit,
    user,
    device,
    remarks,
  });
}

/**
 * Fire event when batch mixing is complete
 */
export async function fireMixingComplete({
  batchId,
  user,
  device,
  remarks,
}) {
  return fireTraceEvent({
    eventType: 'MIXING_COMPLETE',
    module: 'PRODUCTION',
    sourceType: 'Batch',
    sourceId: batchId,
    targetType: 'Batch',
    targetId: batchId,
    batchId,
    user,
    device,
    remarks,
  });
}

/**
 * Fire event when batch is filled into crates
 */
export async function fireFillingOutput({
  batchId,
  crateId,
  quantity,
  unit,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'FILLING_OUTPUT',
    module: 'PRODUCTION',
    sourceType: 'Batch',
    sourceId: batchId,
    targetType: 'Crate',
    targetId: crateId,
    batchId,
    crateId,
    quantity,
    unit,
    user,
    device,
  });
}

/**
 * Fire event when crate is created
 */
export async function fireCrateCreation({
  crateId,
  batchId,
  quantity,
  unit,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'CRATE_CREATION',
    module: 'PRODUCTION',
    sourceType: 'Batch',
    sourceId: batchId,
    targetType: 'Crate',
    targetId: crateId,
    batchId,
    crateId,
    quantity,
    unit,
    user,
    device,
  });
}

/**
 * Fire event when crate moves through chamber
 */
export async function fireChamberMovement({
  crateId,
  batchId,
  sourceLocation,
  targetLocation,
  user,
  device,
  remarks,
}) {
  return fireTraceEvent({
    eventType: 'CHAMBER_MOVEMENT',
    module: 'PRODUCTION',
    sourceType: 'Location',
    sourceId: sourceLocation,
    targetType: 'Location',
    targetId: targetLocation,
    crateId,
    batchId,
    user,
    device,
    remarks,
  });
}

/**
 * Fire event when labels are issued
 */
export async function fireLabellingIssue({
  crateId,
  sku,
  quantity,
  unit,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'LABELLING_ISSUE',
    module: 'LABELLING',
    sourceType: 'Crate',
    sourceId: crateId,
    targetType: 'BoxLabel',
    targetId: 'label_system',
    crateId,
    sku,
    quantity,
    unit,
    user,
    device,
  });
}

/**
 * Fire event when pallet is built
 */
export async function firePalletBuild({
  palletId,
  crateId,
  quantity,
  unit,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'PALLET_BUILD',
    module: 'LABELLING',
    sourceType: 'Crate',
    sourceId: crateId,
    targetType: 'Pallet',
    targetId: palletId,
    palletId,
    crateId,
    quantity,
    unit,
    user,
    device,
  });
}

/**
 * Fire event when dispatch occurs
 */
export async function fireDispatch({
  dispatchId,
  palletId,
  sku,
  quantity,
  unit,
  user,
  device,
  remarks,
}) {
  return fireTraceEvent({
    eventType: 'DISPATCH',
    module: 'WAREHOUSE',
    sourceType: 'Pallet',
    sourceId: palletId,
    targetType: 'Dispatch',
    targetId: dispatchId,
    dispatchId,
    palletId,
    sku,
    quantity,
    unit,
    user,
    device,
    remarks,
  });
}

/**
 * Fire event when rework occurs
 */
export async function fireRework({
  crateId,
  batchId,
  quantity,
  unit,
  reason,
  user,
  device,
}) {
  return fireTraceEvent({
    eventType: 'REWORK',
    module: 'PRODUCTION',
    sourceType: 'Crate',
    sourceId: crateId,
    targetType: 'Rework',
    targetId: `rework_${Date.now()}`,
    crateId,
    batchId,
    quantity,
    unit,
    yieldLoss: 0,
    lossReason: reason,
    isCritical: true,
    user,
    device,
  });
}

/**
 * Fire event for stock adjustment
 */
export async function fireStockAdjustment({
  lotId,
  quantity,
  unit,
  reason,
  user,
  device,
}) {
  const isLoss = quantity < 0;
  return fireTraceEvent({
    eventType: 'STOCK_ADJUSTMENT',
    module: 'WAREHOUSE',
    sourceType: 'Lot',
    sourceId: lotId,
    targetType: 'Adjustment',
    targetId: `adj_${Date.now()}`,
    lotId,
    quantity: Math.abs(quantity),
    unit,
    yieldLoss: isLoss ? Math.abs(quantity) : 0,
    lossReason: reason,
    isCritical: isLoss,
    user,
    device,
  });
}