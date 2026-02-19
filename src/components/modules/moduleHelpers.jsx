/**
 * Module key constants
 */
export const MODULE_KEYS = {
  DASHBOARD:         'DASHBOARD',
  STORES:            'STORES',
  RECIPE:            'RECIPE',
  FILLING:           'FILLING',
  CHAMBER:           'CHAMBER',
  TRANSFER_RECEIVE:  'TRANSFER_RECEIVE',
  LABELLING:         'LABELLING',
  FG:                'FG',
  MASTERDATA:        'MASTERDATA',
  AUDIT:             'AUDIT',
  SYNC_QUEUE:        'SYNC_QUEUE',
  PULL_LISTS:        'PULL_LISTS',
  ALERTS:            'ALERTS',
};

// page → module key
export const PAGE_MODULE_MAP = {
  Dashboard:         'DASHBOARD',
  StoresIssue:       'STORES',
  RecipeStation:     'RECIPE',
  FillingStation:    'FILLING',
  ChamberStation:    'CHAMBER',
  TransferReceiving: 'TRANSFER_RECEIVE',
  LabellingLine:     'LABELLING',
  FGPalletizing:     'FG',
  MasterData:        'MASTERDATA',
  AuditLogPage:      'AUDIT',
  PullLists:         'PULL_LISTS',
  AlertsPage:        'ALERTS',
};

/**
 * Compute effective enabled module keys from DB records.
 * Falls back to all enabled if no DB config exists.
 */
export function computeEffectiveModules(moduleConfigs, roleAccesses, userOverrides, role, userId) {
  if (!moduleConfigs || moduleConfigs.length === 0) return null; // null = use legacy role-based only

  const effectiveSet = new Set();
  for (const mc of moduleConfigs) {
    if (!mc.is_globally_enabled) continue;
    const roleRecord = roleAccesses.find(r => r.role === role && r.module_key === mc.module_key);
    const userRecord = userOverrides.find(u => u.user_id === userId && u.module_key === mc.module_key);
    const roleEnabled = roleRecord ? roleRecord.enabled : false;
    const userEnabled = userRecord ? userRecord.enabled : null;
    const finalEnabled = userEnabled !== null ? userEnabled : roleEnabled;
    if (finalEnabled) effectiveSet.add(mc.module_key);
  }
  return effectiveSet;
}