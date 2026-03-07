// Role definitions and access control

export const ROLES = {
  Admin:              'admin',
  ProductionManager:  'production_manager',
  Stores:             'stores',
  RecipeOperator:     'recipe_operator',
  QA:                 'qa',
  FillingOperator:    'filling_operator',
  ChamberOperator:    'chamber_operator',
  LabellingReceiver:  'labelling_receiver',
  LabellingOperator:  'line_operator',
  LabellingSupervisor:'labelling_supervisor',
  // FG/warehouse roles
  LabelOperator:      'label_operator',
  LabelSupervisor:    'label_supervisor',
  PalletBuilder:      'pallet_builder',
  WarehouseOps:       'warehouse_ops',
  // Purchase roles
  PurchaseUser:       'purchase_user',
  PurchaseManager:    'purchase_manager',
  // Receiving / QC / Accounts (for future pages)
  SecurityGuard:      'security_guard',
  StoreReceiver:      'store_receiver',
  QCInspector:        'qc_inspector',
  AccountsUser:       'accounts_user',
  AccountsManager:    'accounts_manager',
  // Legacy
  FGOperator:         'warehouse',
};

// Pages each role can access
const PURCHASE_PAGES = ['PurchaseOps', 'SupplierManager'];
const APPROVAL_PAGES = ['ApprovalsInbox'];
const GRN_HUB_PAGES = ['PurchaseGRNHub'];

const ACCESS_MAP = {
  admin: [
    'Dashboard','FillingStation','ChamberStation',
    'TransferReceiving','LabellingLine','FGPalletizing','AuditLogPage','MasterData',
    'AlertsPage','PullLists','CustomizeDashboard',
    'BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild','WarehouseOps','BoxStockDashboard','OpeningStockImport',
    'ProductionControl','LabelRollManager','TemplateMappingManager','FeederKiosk','TraceInvestigation',
    ...PURCHASE_PAGES, ...APPROVAL_PAGES, ...GRN_HUB_PAGES,
    'GateEntry', 'GateInbox', 'GRNReceive', 'QCInbox', 'Putaway', 'WarehouseBins',
    'InvoiceCapture', 'ThreeWayMatch', 'PaymentRequests',
    'ShiftKPIDashboard', 'ProductionOrders', 'LiquidPlans',
  ],
  production_manager: [
    'Dashboard','AuditLogPage','MasterData','AlertsPage','PullLists','CustomizeDashboard',
    'FillingStation','LabellingLine','FeederKiosk','TraceInvestigation',
    'BoxLabelApprovals','BoxStockDashboard','ProductionControl',
    'PurchaseOps', ...APPROVAL_PAGES, ...GRN_HUB_PAGES,
  ],
  stores:               ['Dashboard'],
  recipe_operator:      ['Dashboard'],
  qa:                   ['Dashboard','AuditLogPage'],
  filling_operator:     ['Dashboard','FillingStation'],
  chamber_operator:     ['Dashboard','ChamberStation','PullLists'],
  labelling_receiver:   ['Dashboard','TransferReceiving','PullLists'],
  line_operator:        ['Dashboard','LabellingLine','FeederKiosk'],
  labelling_supervisor: ['Dashboard','LabellingLine','TransferReceiving','AlertsPage','PullLists','LabelRollManager','FeederKiosk','TraceInvestigation'],
  // Legacy
  warehouse:            ['Dashboard'],
  // FG roles
  label_operator:       ['Dashboard','BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild'],
  label_supervisor:     ['Dashboard','BoxLabelApprovals','AlertsPage'],
  pallet_builder:       ['Dashboard','BoxPalletBuild','BoxStockDashboard'],
  warehouse_ops:        ['Dashboard','WarehouseOps','BoxStockDashboard','OpeningStockImport'],
  // Purchase roles
  purchase_user:        ['Dashboard', 'PurchaseOps', ...GRN_HUB_PAGES],
  purchase_manager:     ['Dashboard', 'PurchaseOps', 'SupplierManager', ...APPROVAL_PAGES, ...GRN_HUB_PAGES,
                         'GateEntry', 'GateInbox', 'GRNReceive', 'QCInbox', 'Putaway',
                         'InvoiceCapture', 'ThreeWayMatch', 'PaymentRequests'],
  // Receiving / QC / Accounts
  security_guard:       ['Dashboard', 'GateEntry', ...GRN_HUB_PAGES],
  store_receiver:       ['Dashboard', 'GateInbox', 'GRNReceive', 'Putaway', ...GRN_HUB_PAGES],
  qc_inspector:         ['Dashboard', 'QCInbox', ...GRN_HUB_PAGES],
  accounts_user:        ['Dashboard', 'InvoiceCapture', 'ThreeWayMatch', ...GRN_HUB_PAGES],
  accounts_manager:     ['Dashboard', ...APPROVAL_PAGES, 'InvoiceCapture', 'ThreeWayMatch', 'PaymentRequests', ...GRN_HUB_PAGES],
  // Default platform role – broad access (non-admin)
  user: [
    'Dashboard','FillingStation','ChamberStation',
    'TransferReceiving','LabellingLine','AuditLogPage','MasterData','AlertsPage','PullLists','CustomizeDashboard',
    'BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild','WarehouseOps','BoxStockDashboard','OpeningStockImport',
    'PurchaseOps', ...GRN_HUB_PAGES,
    'GateEntry', 'GateInbox', 'GRNReceive', 'QCInbox', 'Putaway',
    'InvoiceCapture', 'ThreeWayMatch', 'PaymentRequests',
  ],
};

export function getRole(user) {
  return user?.role || user?.metadata?.role || 'admin';
}

export function getAllowedPages(user) {
  const role = getRole(user);
  // If role not found in map, return empty (deny all) rather than falling back to admin
  return ACCESS_MAP[role] || ['Dashboard'];
}

export function canAccess(user, page) {
  return getAllowedPages(user).includes(page);
}