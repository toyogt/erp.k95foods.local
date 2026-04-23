/**
 * Smart Picking Engine for Store Stock Issue
 * Generates an optimal picking plan based on FEFO or FIFO strategy.
 */

/**
 * Generate a picking plan for a requested item and quantity.
 * 
 * @param {string} itemCode - The item code to issue
 * @param {number} requestedQty - Total quantity to issue
 * @param {Array} lots - All StoreLot records for this item
 * @param {Array} balances - All StoreStockBalance records
 * @param {string} strategy - 'FEFO' or 'FIFO'
 * @returns {{ plan: Array, totalAvailable: number, shortfall: number }}
 */
export function generatePickingPlan(itemCode, requestedQty, lots, balances, strategy = 'FEFO') {
  // Build stock by lot + location
  const balancesByLot = {};
  balances.forEach(b => {
    if (b.item_code !== itemCode || (b.quantity || 0) <= 0) return;
    if (!balancesByLot[b.lot_id]) balancesByLot[b.lot_id] = [];
    balancesByLot[b.lot_id].push(b);
  });

  // Filter lots that have available stock and are not expired/rejected
  const today = new Date().toISOString().split('T')[0];
  const availableLots = lots.filter(l => {
    if (l.item_code !== itemCode) return false;
    if (['consumed', 'rejected', 'damaged'].includes(l.status)) return false;
    if (!balancesByLot[l.lot_id] || balancesByLot[l.lot_id].length === 0) return false;
    // Exclude expired lots
    if (l.expiry_date && l.expiry_date < today) return false;
    return true;
  });

  // Sort based on strategy
  const sortedLots = [...availableLots].sort((a, b) => {
    if (strategy === 'FEFO') {
      // Primary: earliest expiry_date first; no expiry goes last
      const expA = a.expiry_date || '9999-12-31';
      const expB = b.expiry_date || '9999-12-31';
      if (expA !== expB) return expA.localeCompare(expB);
      // Secondary: earliest mfg_date
      const mfgA = a.mfg_date || '9999-12-31';
      const mfgB = b.mfg_date || '9999-12-31';
      return mfgA.localeCompare(mfgB);
    } else {
      // FIFO: earliest mfg_date first; fallback to created_date
      const mfgA = a.mfg_date || a.created_date || '9999-12-31';
      const mfgB = b.mfg_date || b.created_date || '9999-12-31';
      if (mfgA !== mfgB) return mfgA.localeCompare(mfgB);
      // Secondary: earliest expiry
      const expA = a.expiry_date || '9999-12-31';
      const expB = b.expiry_date || '9999-12-31';
      return expA.localeCompare(expB);
    }
  });

  // Build picking plan
  const plan = [];
  let remaining = requestedQty;
  let totalAvailable = 0;

  for (const lot of sortedLots) {
    const lotBalances = balancesByLot[lot.lot_id] || [];
    const lotTotal = lotBalances.reduce((sum, b) => sum + (b.quantity || 0), 0);
    totalAvailable += lotTotal;

    if (remaining <= 0) continue;

    // Pick from each location within the lot
    for (const bal of lotBalances) {
      if (remaining <= 0) break;
      const pickQty = Math.min(remaining, bal.quantity);
      if (pickQty <= 0) continue;

      plan.push({
        lot_id: lot.lot_id,
        lot,
        balance: bal,
        location_id: bal.location_id,
        location_code: bal.location_code,
        item_code: lot.item_code,
        item_name: lot.item_name,
        uom: lot.uom || bal.uom,
        batch_number: lot.batch_number || '',
        mfg_date: lot.mfg_date || '',
        expiry_date: lot.expiry_date || '',
        supplier_name: lot.supplier_name || '',
        available_at_location: bal.quantity,
        pick_quantity: pickQty,
        strategy,
      });

      remaining -= pickQty;
    }
  }

  return {
    plan,
    totalAvailable,
    shortfall: Math.max(0, requestedQty - (requestedQty - remaining)),
    fulfilled: remaining <= 0,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Get all available items with their total stock for the item selector.
 */
export function buildAvailableItems(lots, balances) {
  const stockByLot = {};
  balances.forEach(b => {
    stockByLot[b.lot_id] = (stockByLot[b.lot_id] || 0) + (b.quantity || 0);
  });

  const locationsByLot = {};
  balances.forEach(b => {
    if ((b.quantity || 0) <= 0) return;
    if (!locationsByLot[b.lot_id]) locationsByLot[b.lot_id] = [];
    locationsByLot[b.lot_id].push({
      location_id: b.location_id,
      location_code: b.location_code,
      stock: b.quantity || 0,
      uom: b.uom,
      balance_id: b.id,
    });
  });

  const itemMap = {};
  lots.forEach(l => {
    const lotStock = stockByLot[l.lot_id] || 0;
    if (lotStock <= 0) return;
    if (!itemMap[l.item_code]) {
      itemMap[l.item_code] = {
        item_code: l.item_code,
        item_name: l.item_name,
        uom: l.uom,
        lots: [],
        total_stock: 0,
      };
    }
    itemMap[l.item_code].lots.push({
      ...l,
      actual_stock: lotStock,
      locations: locationsByLot[l.lot_id] || [],
    });
    itemMap[l.item_code].total_stock += lotStock;
  });

  return Object.values(itemMap);
}