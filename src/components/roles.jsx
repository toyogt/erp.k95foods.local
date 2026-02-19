// Role definitions and access control

export const ROLES = {
  Admin: 'admin',
  ProductionManager: 'production_manager',
  Stores: 'stores',
  RecipeOperator: 'recipe_operator',
  QA: 'qa',
  FillingOperator: 'filling_operator',
  ChamberOperator: 'chamber_operator',
  LabellingReceiver: 'labelling_receiver',
  LabellingOperator: 'line_operator',
  LabellingSupervisor: 'labelling_supervisor',
  FGOperator: 'warehouse',
};

// Pages each role can access (always includes Dashboard)
const ACCESS_MAP = {
  admin: ['Dashboard', 'StoresIssue', 'RecipeStation', 'FillingStation', 'ChamberStation', 'TransferReceiving', 'LabellingLine', 'FGPalletizing', 'AuditLogPage', 'MasterData'],
  production_manager: ['Dashboard', 'AuditLogPage', 'MasterData'],
  stores: ['Dashboard', 'StoresIssue'],
  recipe_operator: ['Dashboard', 'RecipeStation'],
  qa: ['Dashboard', 'RecipeStation', 'AuditLogPage'],
  filling_operator: ['Dashboard', 'FillingStation'],
  chamber_operator: ['Dashboard', 'ChamberStation'],
  labelling_receiver: ['Dashboard', 'TransferReceiving'],
  line_operator: ['Dashboard', 'LabellingLine'],
  labelling_supervisor: ['Dashboard', 'LabellingLine', 'TransferReceiving'],
  warehouse: ['Dashboard', 'FGPalletizing'],
  // user is default platform role - treat as admin for now
  user: ['Dashboard', 'StoresIssue', 'RecipeStation', 'FillingStation', 'ChamberStation', 'TransferReceiving', 'LabellingLine', 'FGPalletizing', 'AuditLogPage', 'MasterData'],
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