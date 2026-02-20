import { base44 } from '@/api/base44Client';
import { enqueue } from './offlineQueue';
import { logAudit } from '@/components/AuditLogger';

/** Create or update a crate, queue if offline */
export async function saveCrate(data, user) {
  try {
    // Check if crate already exists
    const existing = await base44.entities.Crate.filter({ crate_id: data.crate_id });
    let crate;
    if (existing.length > 0) {
      crate = await base44.entities.Crate.update(existing[0].id, data);
    } else {
      crate = await base44.entities.Crate.create(data);
    }
    return crate;
  } catch {
    enqueue({ type: 'create', entity: 'Crate', data, userEmail: user?.email, userName: user?.full_name, auditAction: 'CrateScanned', auditEntityId: data.crate_id });
    return { ...data, id: '_offline_' + data.crate_id };
  }
}

/** Create or update a pallet, queue if offline.
 *  Enforces:
 *   - No reuse while still active (non-OPEN/EMPTY status)
 *   - If existing pallet has product/batch/bottle locked, new data must match
 */
export async function savePallet(data, user) {
  try {
    const existing = await base44.entities.Pallet.filter({ pallet_id: data.pallet_id });
    if (existing.length > 0) {
      const pallet = existing[0];
      const blockedStatuses = ['IN_CHAMBER', 'POST_CHAMBER', 'IN_TRANSIT', 'RECEIVED', 'AT_ZONE', 'CLOSED'];
      if (blockedStatuses.includes(pallet.status)) {
        throw new Error(`Pallet ${data.pallet_id} is currently "${pallet.status}" and cannot be reused until it is emptied.`);
      }
      // Enforce type lock: if pallet already has batch/product, new data must match
      if (pallet.batch_id && data.batch_id && pallet.batch_id !== data.batch_id) {
        throw new Error(`Pallet ${data.pallet_id} is locked to batch ${pallet.batch_id}. Cannot assign batch ${data.batch_id}.`);
      }
      if (pallet.product_code && data.product_code && pallet.product_code !== data.product_code) {
        throw new Error(`Pallet ${data.pallet_id} is locked to product ${pallet.product_code}. Cannot assign ${data.product_code}.`);
      }
      return await base44.entities.Pallet.update(pallet.id, data);
    } else {
      return await base44.entities.Pallet.create(data);
    }
  } catch (e) {
    if (e.message?.includes('cannot be reused') || e.message?.includes('locked to')) throw e;
    enqueue({ type: 'create', entity: 'Pallet', data, userEmail: user?.email, userName: user?.full_name, auditAction: 'PalletCreated', auditEntityId: data.pallet_id });
    return { ...data, id: '_offline_' + data.pallet_id };
  }
}

/** Link crates to pallet, queue if offline */
export async function linkCratesToPallet(palletId, crateIds, user) {
  for (const crateId of crateIds) {
    try {
      await base44.entities.PalletCrateLink.create({ pallet_id: palletId, crate_id: crateId });
    } catch {
      enqueue({ type: 'create', entity: 'PalletCrateLink', data: { pallet_id: palletId, crate_id: crateId }, userEmail: user?.email, userName: user?.full_name });
    }
  }
}

/** Log a WIP movement, queue if offline */
export async function logMovement({ entityType, entityId, from, to, machineId, user }) {
  const data = {
    entity_type: entityType,
    entity_id: entityId,
    source_location: from || '',
    destination_location: to,
    machine_id: machineId || '',
    moved_by: user?.email || '',
    moved_at: new Date().toISOString(),
  };
  try {
    await base44.entities.WIPMovementLog.create(data);
  } catch {
    enqueue({ type: 'create', entity: 'WIPMovementLog', data, userEmail: user?.email });
  }
  await logAudit({ action: `Moved ${entityType} ${entityId} → ${to}`, entity_type: entityType, entity_id: entityId, user });
}

/** Move pallet + all its crates to a new location */
export async function movePalletWithCrates({ palletDbId, palletId, toLocation, toStatus, toCrateStatus, machineId, user }) {
  // Update pallet
  try {
    await base44.entities.Pallet.update(palletDbId, { current_location: toLocation, status: toStatus });
  } catch {
    enqueue({ type: 'update', entity: 'Pallet', entityId: palletDbId, data: { current_location: toLocation, status: toStatus }, userEmail: user?.email });
  }
  await logMovement({ entityType: 'PALLET', entityId: palletId, from: null, to: toLocation, machineId, user });

  // Get linked crates
  let links = [];
  try {
    links = await base44.entities.PalletCrateLink.filter({ pallet_id: palletId });
  } catch { /* offline, skip */ }

  for (const link of links) {
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: link.crate_id });
      if (crates.length > 0) {
        await base44.entities.Crate.update(crates[0].id, { current_location: toLocation, status: toCrateStatus, last_scan_time: new Date().toISOString() });
      }
    } catch {
      enqueue({ type: 'update', entity: 'Crate', data: { crate_id: link.crate_id, current_location: toLocation, status: toCrateStatus }, userEmail: user?.email });
    }
    await logMovement({ entityType: 'CRATE', entityId: link.crate_id, from: null, to: toLocation, machineId, user });
  }
}