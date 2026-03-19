import { base44 } from '@/api/base44Client';

/**
 * Get allowed pages for a user from database AppRole
 * Falls back to hardcoded ACCESS_MAP for legacy roles
 */
export async function getAllowedPagesFromDB(user) {
  if (!user?.role) return ['Dashboard'];
  
  // Admin always has full access
  if (user.role === 'admin') {
    return ['*']; // Wildcard means all pages
  }

  try {
    // Fetch the AppRole record for this user's role
    const roles = await base44.entities.AppRole.filter({ 
      role_key: user.role, 
      is_active: true 
    });

    if (roles?.[0]?.module_access?.length > 0) {
      // New system: use database module_access
      return roles[0].module_access;
    }
  } catch (err) {
    console.warn('Failed to fetch role permissions:', err);
  }

  // Fallback: use hardcoded map for legacy roles
  return getLegacyAllowedPages(user.role);
}

/**
 * Legacy hardcoded access map (fallback only)
 */
function getLegacyAllowedPages(roleKey) {
  const PURCHASE_PAGES = ['PurchaseOps', 'SupplierManager'];
  const APPROVAL_PAGES = ['ApprovalsInbox'];
  const GRN_HUB_PAGES = ['PurchaseGRNHub'];

  const ACCESS_MAP = {
    admin: ['*'],
    production_manager: [
      'Dashboard','AuditLogPage','MasterData','AlertsPage','PullLists','CustomizeDashboard',
      'FillingStation','LabellingLine','FeederKiosk','TraceInvestigation',
      'BoxLabelApprovals','BoxStockDashboard','ProductionControl',
      'PurchaseOps', ...APPROVAL_PAGES, ...GRN_HUB_PAGES,
    ],
    stores: ['Dashboard'],
    recipe_operator: ['Dashboard'],
    qa: ['Dashboard','AuditLogPage'],
    filling_operator: ['Dashboard','FillingStation'],
    chamber_operator: ['Dashboard','ChamberStation','PullLists'],
    labelling_receiver: ['Dashboard','TransferReceiving','PullLists'],
    line_operator: ['Dashboard','LabellingLine','FeederKiosk'],
    labelling_supervisor: ['Dashboard','LabellingLine','TransferReceiving','AlertsPage','PullLists','LabelRollManager','FeederKiosk','TraceInvestigation'],
    warehouse: ['FGWarehouse'],
    label_operator: ['Dashboard','BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild'],
    label_supervisor: ['Dashboard','BoxLabelApprovals','AlertsPage'],
    pallet_builder: ['Dashboard','BoxPalletBuild','BoxStockDashboard'],
    warehouse_ops: ['Dashboard','WarehouseOps','BoxStockDashboard','OpeningStockImport','FGWarehouse'],
    purchase_user: ['Dashboard', 'PurchaseOps', ...GRN_HUB_PAGES],
    purchase_manager: ['Dashboard', 'PurchaseOps', 'SupplierManager', ...APPROVAL_PAGES, ...GRN_HUB_PAGES,
                       'GateEntry', 'GateInbox', 'GRNReceive', 'QCInbox', 'Putaway',
                       'InvoiceCapture', 'ThreeWayMatch', 'PaymentRequests'],
    dispatch_officer: ['Dashboard', 'DispatchCrates'],
    security_guard: ['Dashboard', 'GateEntry', ...GRN_HUB_PAGES],
    store_receiver: ['Dashboard', 'GateInbox', 'GRNReceive', 'Putaway', ...GRN_HUB_PAGES],
    qc_inspector: ['Dashboard', 'QCInbox', ...GRN_HUB_PAGES],
    accounts_user: ['Dashboard', 'InvoiceCapture', 'ThreeWayMatch', ...GRN_HUB_PAGES],
    accounts_manager: ['Dashboard', ...APPROVAL_PAGES, 'InvoiceCapture', 'ThreeWayMatch', 'PaymentRequests', ...GRN_HUB_PAGES],
    // Default user role has NO access (empty array)
    user: [],
  };

  return ACCESS_MAP[roleKey] || [];
}