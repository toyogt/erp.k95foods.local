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
  // New FG/warehouse roles
  LabelOperator:      'label_operator',
  LabelSupervisor:    'label_supervisor',
  PalletBuilder:      'pallet_builder',
  WarehouseOps:       'warehouse_ops',
  // Legacy (kept for backward compat, access removed)
  FGOperator:         'warehouse',
};

// Pages each role can access
const ACCESS_MAP = {
  admin: [
    'Dashboard','StoresIssue','RecipeStation','FillingStation','ChamberStation',
    'TransferReceiving','LabellingLine','FGPalletizing','AuditLogPage','MasterData',
    'AlertsPage','PullLists','CustomizeDashboard',
    'BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild','WarehouseOps','BoxStockDashboard','OpeningStockImport',
  ],
  production_manager: [
    'Dashboard','AuditLogPage','MasterData','AlertsPage','PullLists','CustomizeDashboard',
    'FillingStation','LabellingLine',
    'BoxLabelApprovals','BoxStockDashboard',
  ],
  stores:               ['Dashboard','StoresIssue'],
  recipe_operator:      ['Dashboard','RecipeStation'],
  qa:                   ['Dashboard','RecipeStation','AuditLogPage'],
  filling_operator:     ['Dashboard','FillingStation'],
  chamber_operator:     ['Dashboard','ChamberStation','PullLists'],
  labelling_receiver:   ['Dashboard','TransferReceiving','PullLists'],
  line_operator:        ['Dashboard','LabellingLine'],
  labelling_supervisor: ['Dashboard','LabellingLine','TransferReceiving','AlertsPage','PullLists'],
  // Legacy warehouse role – no longer gets FGPalletizing or new pages by default
  warehouse:            ['Dashboard'],
  // New roles
  label_operator:       ['Dashboard','BoxLabelPrint'],
  label_supervisor:     ['Dashboard','BoxLabelApprovals','AlertsPage'],
  pallet_builder:       ['Dashboard','BoxPalletBuild'],
  warehouse_ops:        ['Dashboard','WarehouseOps','BoxStockDashboard'],
  // Default platform role – broad access (non-admin)
  user: [
    'Dashboard','StoresIssue','RecipeStation','FillingStation','ChamberStation',
    'TransferReceiving','LabellingLine','AuditLogPage','MasterData','AlertsPage','PullLists','CustomizeDashboard',
    'BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild','WarehouseOps','BoxStockDashboard','OpeningStockImport',
  ],
};

export function getRole(user) {
  return user?.role || user?.metadata?.role || 'admin';
}

export function getAllowedPages(user) {
  const role = getRole(user);
  return ACCESS_MAP[role] || ACCESS_MAP['admin'];
}

export function canAccess(user, page) {
  return getAllowedPages(user).includes(page);
}