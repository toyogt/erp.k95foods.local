/**
 * FMS App Events Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the single source of truth for all app events that can:
 *   (A) AUTO-TRIGGER a process  →  used in ProcessForm as "Trigger Source"
 *   (B) AUTO-COMPLETE a step    →  used in StepForm as "Auto-Complete Event"
 *
 * To add a new event in future — just add an entry here. No code changes needed
 * elsewhere. The Process Designer will immediately see the new option in the UI.
 *
 * Fields:
 *   key      — unique machine key used in code (matches trigger_source / auto_complete_event)
 *   label    — human-readable name shown in the UI dropdown
 *   category — groups events in the dropdown for readability
 *   canTrigger  — true if this event can auto-START a process
 *   canComplete — true if this event can auto-COMPLETE a step
 */

export const FMS_APP_EVENTS = [
  // ── Purchase & GRN ──────────────────────────────────────────────────────────
  { key: 'purchase_request_created',  label: 'Purchase Request Created',   category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },
  { key: 'purchase_order_created',    label: 'Purchase Order Created',      category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },
  { key: 'purchase_order_approved',   label: 'Purchase Order Approved',     category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },
  { key: 'gate_entry_created',        label: 'Gate Entry Created',          category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },
  { key: 'grn_received',              label: 'GRN Received',                category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },
  { key: 'grn_qc_approved',           label: 'GRN QC Approved',             category: 'Purchase & GRN', canTrigger: false, canComplete: true  },
  { key: 'grn_qc_rejected',           label: 'GRN QC Rejected',             category: 'Purchase & GRN', canTrigger: false, canComplete: true  },
  { key: 'invoice_captured',          label: 'Supplier Invoice Captured',   category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },
  { key: 'three_way_match_done',      label: '3-Way Match Completed',       category: 'Purchase & GRN', canTrigger: false, canComplete: true  },
  { key: 'payment_request_created',   label: 'Payment Request Created',     category: 'Purchase & GRN', canTrigger: true,  canComplete: true  },

  // ── Production ──────────────────────────────────────────────────────────────
  { key: 'production_order_created',  label: 'Production Order Created',    category: 'Production',     canTrigger: true,  canComplete: true  },
  { key: 'liquid_plan_created',       label: 'Liquid Batch Plan Created',   category: 'Production',     canTrigger: true,  canComplete: true  },
  { key: 'batch_started',             label: 'Batch Started',               category: 'Production',     canTrigger: true,  canComplete: true  },
  { key: 'batch_qc_approved',         label: 'Batch QC Approved',           category: 'Production',     canTrigger: false, canComplete: true  },
  { key: 'batch_qc_rejected',         label: 'Batch QC Rejected',           category: 'Production',     canTrigger: false, canComplete: true  },
  { key: 'batch_completed',           label: 'Batch Completed',             category: 'Production',     canTrigger: false, canComplete: true  },
  { key: 'packing_wo_created',        label: 'Packing Work Order Created',  category: 'Production',     canTrigger: true,  canComplete: true  },
  { key: 'packing_wo_completed',      label: 'Packing Work Order Completed',category: 'Production',     canTrigger: false, canComplete: true  },

  // ── Warehouse & Dispatch ─────────────────────────────────────────────────────
  { key: 'putaway_done',              label: 'Putaway Completed',           category: 'Warehouse',      canTrigger: false, canComplete: true  },
  { key: 'dispatch_created',          label: 'Dispatch Created',            category: 'Warehouse',      canTrigger: true,  canComplete: true  },
  { key: 'dispatch_completed',        label: 'Dispatch Completed',          category: 'Warehouse',      canTrigger: false, canComplete: true  },
  { key: 'fg_pallet_sealed',          label: 'FG Pallet Sealed',            category: 'Warehouse',      canTrigger: false, canComplete: true  },

  // ── Quality ─────────────────────────────────────────────────────────────────
  { key: 'qc_inspection_created',     label: 'QC Inspection Created',       category: 'Quality',        canTrigger: true,  canComplete: true  },
  { key: 'qc_inspection_completed',   label: 'QC Inspection Completed',     category: 'Quality',        canTrigger: false, canComplete: true  },

  // ── Labels & Printing ───────────────────────────────────────────────────────
  { key: 'label_approval_requested',  label: 'Label Approval Requested',    category: 'Labels',         canTrigger: true,  canComplete: true  },
  { key: 'label_approved',            label: 'Label Approved',              category: 'Labels',         canTrigger: false, canComplete: true  },
  { key: 'label_rejected',            label: 'Label Rejected',              category: 'Labels',         canTrigger: false, canComplete: true  },

  // ── Access & Approvals ──────────────────────────────────────────────────────
  { key: 'approval_rule_changed',     label: 'Approval Rule Changed',       category: 'Admin',          canTrigger: false, canComplete: true  },
  { key: 'user_role_changed',         label: 'User Role Changed',           category: 'Admin',          canTrigger: false, canComplete: true  },

  // ── Sales ─────────────────────────────────────────────────────────────────────
  { key: 'sales_order_created',         label: 'Sales Order Created',           category: 'Sales', canTrigger: true,  canComplete: true  },
  { key: 'sales_logistics_review',      label: 'Sales Under Logistics Review',  category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_stock_validated',       label: 'Sales Stock Validated',         category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_picklist_created',      label: 'Sales Picklist Created',        category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_dispatch_scheduled',    label: 'Sales Dispatch Scheduled',      category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_picklist_completed',    label: 'Sales Pick & Pack Done',        category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_dn_created',            label: 'Delivery Note Created',         category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_dn_submitted',          label: 'Delivery Note Submitted',       category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_dispatched',            label: 'Sales Dispatched',              category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_invoiced',              label: 'Sales Invoice Created',         category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_invoice_approved',      label: 'Sales Invoice Approved',        category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_send_for_tally',        label: 'Sales Send for Tally Posting',  category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_tally_posted',          label: 'Sales Posted to Tally',         category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_invoice_delivered',     label: 'Sales Invoice Delivered',       category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_payment_received',      label: 'Sales Payment Received',        category: 'Sales', canTrigger: false, canComplete: true  },
  { key: 'sales_return_initiated',      label: 'Sales Return Initiated',        category: 'Sales', canTrigger: true,  canComplete: true  },

  // ── General / Manual ────────────────────────────────────────────────────────
  { key: 'custom_event_1',            label: 'Custom Event 1',              category: 'Custom',         canTrigger: true,  canComplete: true  },
  { key: 'custom_event_2',            label: 'Custom Event 2',              category: 'Custom',         canTrigger: true,  canComplete: true  },
  { key: 'custom_event_3',            label: 'Custom Event 3',              category: 'Custom',         canTrigger: true,  canComplete: true  },
];

/** Events that can auto-START a process (trigger_source dropdown) */
export const TRIGGER_EVENTS = FMS_APP_EVENTS.filter(e => e.canTrigger);

/** Events that can auto-COMPLETE a step (auto_complete_event dropdown) */
export const COMPLETE_EVENTS = FMS_APP_EVENTS.filter(e => e.canComplete);

/** Group events by category for grouped dropdowns */
export function groupEventsByCategory(events) {
  return events.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});
}