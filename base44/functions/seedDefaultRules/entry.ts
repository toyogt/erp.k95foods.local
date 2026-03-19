/**
 * Seed Default Rules
 * Initialize core business rules for the factory
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const DEFAULT_RULES = [
  // ─── WAREHOUSE ───
  {
    rule_key: 'DISPATCH_STOCK_CHECK',
    module: 'WAREHOUSE',
    entity_type: 'Dispatch',
    action_type: 'create',
    rule_name: 'Dispatch Stock Availability',
    description: 'Prevent dispatch if stock not available in correct location',
    validation_type: 'stock_availability',
    error_message: 'Cannot dispatch. Required stock is not available in the dispatch location. Check inventory levels.',
    allow_override: true,
    override_roles: ['warehouse_ops', 'production_manager', 'admin'],
    reason_codes: [
      { code: 'STOCK_IN_TRANSIT', label: 'Stock in transit, verified via supplier' },
      { code: 'MANUAL_COUNT_VARIANCE', label: 'Manual recount confirmed stock availability' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 10,
  },
  {
    rule_key: 'STOCK_LOCATION_LOCK',
    module: 'WAREHOUSE',
    entity_type: 'StockMovement',
    action_type: 'create',
    rule_name: 'Location Lock Check',
    description: 'Prevent stock movement from locked locations',
    validation_type: 'lock_status',
    error_message: 'This location is locked due to ongoing inventory audit. Request unlock from supervisor.',
    allow_override: true,
    override_roles: ['warehouse_ops', 'admin'],
    reason_codes: [
      { code: 'AUDIT_COMPLETE', label: 'Inventory audit completed' },
      { code: 'SUPERVISOR_APPROVAL', label: 'Supervisor approved early release' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 11,
  },

  // ─── PRODUCTION ───
  {
    rule_key: 'PALLET_APPROVAL_CHECK',
    module: 'PRODUCTION',
    entity_type: 'Pallet',
    action_type: 'dispatch',
    rule_name: 'Pallet Approval Required',
    description: 'Pallet must be approved before dispatch',
    validation_type: 'approval_requirement',
    error_message: 'Pallet cannot be dispatched until approved by production manager. Current status: {status}.',
    allow_override: true,
    override_roles: ['production_manager', 'admin'],
    reason_codes: [
      { code: 'VERBAL_APPROVAL', label: 'Verbal approval from manager documented' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 20,
  },
  {
    rule_key: 'PALLET_FULLY_BUILT',
    module: 'PRODUCTION',
    entity_type: 'Pallet',
    action_type: 'close',
    rule_name: 'Pallet Must Be Fully Built',
    description: 'Cannot close pallet with missing or incomplete crates',
    validation_type: 'status_requirement',
    error_message: 'Pallet is not fully built. All crate slots must be filled before closing.',
    allow_override: true,
    override_roles: ['production_manager', 'admin'],
    reason_codes: [
      { code: 'PARTIAL_REQUIRED', label: 'Partial pallet authorized by production' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 21,
  },
  {
    rule_key: 'CRATE_LOCK_CHECK',
    module: 'PRODUCTION',
    entity_type: 'Crate',
    action_type: 'reassign',
    rule_name: 'Crate Lock Verification',
    description: 'Cannot reassign crate if locked in closed pallet',
    validation_type: 'lock_status',
    error_message: 'Crate is locked in a closed pallet. Contact pallet manager for reassignment.',
    allow_override: true,
    override_roles: ['production_manager', 'admin'],
    reason_codes: [
      { code: 'PALLET_REOPENED', label: 'Parent pallet has been reopened' },
      { code: 'PRODUCTION_EXCEPTION', label: 'Production exception approved' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 22,
  },

  // ─── GRN ───
  {
    rule_key: 'GRN_TOLERANCE_LIMIT',
    module: 'GRN',
    entity_type: 'GRNItem',
    action_type: 'receive',
    rule_name: 'Goods Receipt Tolerance Check',
    description: 'Receiving quantity must be within tolerance of purchase order',
    validation_type: 'tolerance_limit',
    error_message: 'Receiving quantity exceeds the allowed tolerance ({tolerance}%) for this item. Quantity: {total}, Allowed: {allowed}, Excess: {excess}. Requires supervisor approval.',
    allow_override: true,
    override_roles: ['store_receiver', 'purchase_manager', 'admin'],
    reason_codes: [
      { code: 'SUPPLIER_DOCUMENT', label: 'Supplier documentation supports overage' },
      { code: 'QUALITY_CHECK', label: 'Manual count verified by QC' },
      { code: 'CONTRACT_VARIANCE', label: 'Covered under supplier contract' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 30,
  },
  {
    rule_key: 'GRN_DUPLICATE_RECEIVE',
    module: 'GRN',
    entity_type: 'GRNItem',
    action_type: 'receive',
    rule_name: 'Prevent Duplicate Receipts',
    description: 'GRN line cannot be received twice',
    validation_type: 'reference_integrity',
    error_message: 'This GRN line has already been received. Duplicate receipt prevented.',
    allow_override: false,
    override_roles: [],
    reason_codes: [],
    severity: 'block',
    is_active: true,
    sort_order: 31,
  },

  // ─── LABELLING ───
  {
    rule_key: 'ARTWORK_REVISION_MATCH',
    module: 'LABELLING',
    entity_type: 'BoxLabel',
    action_type: 'approve',
    rule_name: 'Label Artwork Revision Match',
    description: 'Artwork and label revisions must match before approval',
    validation_type: 'data_consistency',
    error_message: 'Artwork revision ({artwork}) does not match label revision ({label}). Update artwork before approving.',
    allow_override: true,
    override_roles: ['label_supervisor', 'production_manager', 'admin'],
    reason_codes: [
      { code: 'REVISION_NOTED', label: 'Revision discrepancy documented and approved' },
    ],
    severity: 'warning',
    is_active: true,
    sort_order: 40,
  },

  // ─── ACCOUNTS ───
  {
    rule_key: 'QC_HOLD_STOCK_BLOCK',
    module: 'ACCOUNTS',
    entity_type: 'StockMovement',
    action_type: 'issue',
    rule_name: 'QC Hold Stock Cannot Be Issued',
    description: 'Stock on quality control hold cannot be issued to production',
    validation_type: 'status_requirement',
    error_message: 'This stock batch is on quality control hold. Contact QC team for clearance before issuing.',
    allow_override: true,
    override_roles: ['qc_inspector', 'production_manager', 'admin'],
    reason_codes: [
      { code: 'QC_CLEARED', label: 'QC inspection completed and batch cleared' },
      { code: 'EMERGENCY_PRODUCTION', label: 'Emergency production run authorized' },
    ],
    severity: 'block',
    is_active: true,
    sort_order: 50,
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Check if rules already exist
    const existing = await base44.entities.RulesConfig.list();
    if (existing && existing.length > 0) {
      return Response.json({
        success: false,
        message: 'Rules already seeded. To re-seed, delete existing rules first.',
        count: existing.length,
      });
    }

    // Create default rules
    const created = [];
    for (const rule of DEFAULT_RULES) {
      try {
        const result = await base44.entities.RulesConfig.create(rule);
        created.push({
          rule_key: rule.rule_key,
          id: result.id,
        });
      } catch (error) {
        console.error(`Failed to create rule ${rule.rule_key}:`, error);
      }
    }

    return Response.json({
      success: true,
      message: `Seeded ${created.length} default rules`,
      created,
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});