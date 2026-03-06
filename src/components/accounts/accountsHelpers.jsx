import { base44 } from '@/api/base44Client';

export function genId(prefix) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${rand}`;
}

export async function logAccountsAudit({ action, entity_type, entity_id, details, user }) {
  try {
    await base44.entities.AuditLog.create({
      action,
      entity_type: entity_type || '',
      entity_id: entity_id || '',
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: details || {},
      station: 'ACCOUNTS',
      synced: true,
    });
  } catch (_) {}
}

export const INVOICE_STATUS_COLOR = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  MATCHED_OK: 'bg-green-100 text-green-700',
  EXCEPTION: 'bg-red-100 text-red-700',
  APPROVED_FOR_PAYMENT: 'bg-purple-100 text-purple-700',
  PAID: 'bg-slate-200 text-slate-500',
};

export const PAYMENT_STATUS_COLOR = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAID: 'bg-slate-200 text-slate-500',
};

/**
 * Find candidate POs by supplier + date window
 */
export async function findCandidatePOs(supplierId, dateWindow = 90) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateWindow);
    const isoStart = startDate.toISOString().split('T')[0];

    const pos = await base44.entities.PurchaseOrder.filter({
      supplier_id: supplierId,
      status: { $in: ['APPROVED', 'SENT', 'PART_RECEIVED'] }
    });
    return pos.filter(p => p.po_date >= isoStart).sort((a, b) => new Date(b.po_date) - new Date(a.po_date));
  } catch (_) {
    return [];
  }
}

/**
 * Get QC-passed received quantities per item from GRNs
 */
export async function getQCPassedQtyByItem(poId) {
  try {
    const grns = await base44.entities.GRNHeader.filter({ po_id: poId, status: 'QC_PASSED' });
    const grnIds = grns.map(g => g.grn_id);
    if (!grnIds.length) return {};

    const grnItems = await base44.entities.GRNItem.filter({});
    const result = {};
    grnItems.forEach(item => {
      if (grnIds.includes(item.grn_id)) {
        result[item.item_code] = (result[item.item_code] || 0) + item.received_qty;
      }
    });
    return result;
  } catch (_) {
    return {};
  }
}

/**
 * Get PO item details (ordered qty, rate)
 */
export async function getPOItems(poId) {
  try {
    return await base44.entities.PurchaseOrderItem.filter({ po_id: poId });
  } catch (_) {
    return [];
  }
}

/**
 * Perform 3-way match (PO vs GRN vs Invoice)
 * Returns { status: 'OK' | 'EXCEPTION', exceptions: [...], details: {...} }
 */
export async function perform3WayMatch(invoiceItems, poId, toleranceConfig) {
  const poItems = await getPOItems(poId);
  const qcPassedQty = await getQCPassedQtyByItem(poId);

  const exceptions = [];
  const details = {};

  invoiceItems.forEach(invItem => {
    const poItem = poItems.find(p => p.item_code === invItem.item_code);
    if (!poItem) {
      exceptions.push(`Item ${invItem.item_code} not found in PO`);
      return;
    }

    const qcPassedQtyVal = qcPassedQty[invItem.item_code] || 0;
    const maxPayableQty = Math.min(poItem.qty, qcPassedQtyVal);

    // Qty validation
    const qtyVariance = ((invItem.qty - maxPayableQty) / maxPayableQty) * 100;
    if (invItem.qty > maxPayableQty) {
      const overTolerance = toleranceConfig?.qty_over_tolerance_percent || 0;
      if (qtyVariance > overTolerance) {
        exceptions.push(
          `Item ${invItem.item_code}: Invoice qty ${invItem.qty} exceeds max payable qty ${maxPayableQty} by ${qtyVariance.toFixed(1)}%`
        );
      }
    } else if (invItem.qty < maxPayableQty && !toleranceConfig?.allow_under_delivery) {
      exceptions.push(`Item ${invItem.item_code}: Under-delivery not allowed. Invoice ${invItem.qty} < Max payable ${maxPayableQty}`);
    }

    // Price validation
    const priceVariance = ((invItem.rate - poItem.rate) / poItem.rate) * 100;
    if (invItem.rate > poItem.rate) {
      const overTolerance = toleranceConfig?.price_over_tolerance_percent || 0;
      if (priceVariance > overTolerance) {
        exceptions.push(
          `Item ${invItem.item_code}: Invoice rate ${invItem.rate} exceeds PO rate ${poItem.rate} by ${priceVariance.toFixed(1)}%`
        );
      }
    }

    details[invItem.item_code] = {
      po_qty: poItem.qty,
      po_rate: poItem.rate,
      qc_passed_qty: qcPassedQtyVal,
      max_payable_qty: maxPayableQty,
      inv_qty: invItem.qty,
      inv_rate: invItem.rate,
      qty_variance_pct: qtyVariance.toFixed(1),
      price_variance_pct: priceVariance.toFixed(1),
    };
  });

  return {
    status: exceptions.length ? 'EXCEPTION' : 'OK',
    exceptions,
    details,
  };
}

export async function createAlertEvent(inv, user) {
  try {
    await base44.entities.AlertEvent.create({
      event_type: 'INVOICE_EXCEPTION',
      entity_type: 'SupplierInvoice',
      entity_id: inv.inv_id,
      severity: 'HIGH',
      title: `Invoice Exception: ${inv.inv_id}`,
      description: inv.exception_summary || 'Match exception detected',
      assigned_to: 'accounts_manager',
      status: 'OPEN',
      created_by: user?.email || '',
    });
  } catch (_) {}
}