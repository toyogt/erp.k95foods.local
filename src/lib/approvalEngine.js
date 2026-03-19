/**
 * Approval Engine
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for document approval rule enforcement.
 * Reads DocumentApprovalRule entity from DB — no hardcoded role checks.
 *
 * Usage:
 *   const { rules, canPerformAction, getActionsForDoc } = useApprovalRules();
 *   canPerformAction(user, 'PurchaseRequest', 'SUBMITTED', 'APPROVED') → true/false
 *   getActionsForDoc(user, 'PurchaseRequest', 'SUBMITTED') → [{action_label, to_state, ...}]
 */

import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// ── Module key → page keys mapping (mirrors moduleConfig.js) ──────────────────
export const MODULE_PAGES = {
  DASHBOARD:   ['Dashboard'],
  PRODUCTION:  ['ProductionControl','ProductionOrders','LiquidPlans','FillingStation','ChamberStation','RecipeStation','ShiftKPIDashboard','PullLists'],
  LABELLING:   ['LabellingLine','LabelRollManager','BoxLabelPrint','BoxLabelApprovals','BoxPalletBuild','FeederKiosk'],
  WAREHOUSE:   ['TransferReceiving','DispatchCrates','FGWarehouse','WarehouseOps','BoxStockDashboard','OpeningStockImport'],
  PURCHASE:    ['PurchaseOps','SupplierManager','ApprovalsInbox'],
  GRN:         ['GateEntry','GateInbox','GRNReceive','Putaway'],
  QUALITY:     ['QCInbox'],
  ACCOUNTS:    ['InvoiceCapture','ThreeWayMatch','PaymentRequests'],
  FMS:         ['FMSMyTasks','FMSActiveRuns','FMSMonitor','FMSProcesses','FMSUsers'],
  ADMIN:       ['MasterData','SKUSetup','RecipeBuilder','IngredientManager','IngredientGroupManager','UOMManager','BoxTypeManager','LabelArtworkManager','RyanTemplateManager','ProductTaxonomy','WarehouseBins','TraceInvestigation','AlertsPage','AuditLogPage','UserManagement','RoleManager','ApprovalRulesManager'],
};

export const ALL_MODULE_KEYS = Object.keys(MODULE_PAGES);

// Admin-only pages that never appear in role module access (always admin only)
export const ADMIN_ONLY_PAGES = ['UserManagement', 'RoleManager', 'ApprovalRulesManager', 'FMSProcesses', 'SKUSetup', 'RecipeBuilder'];

/**
 * Check if a user's role key can access a given page, based on AppRole records.
 * Falls back to admin = full access.
 */
export function canAccessPageWithRole(roleRecord, pageKey) {
  if (!roleRecord) return false;
  if (roleRecord.role_key === 'admin') return true;
  // Page-level override
  if (roleRecord.page_access?.includes(pageKey)) return true;
  // Module-level access
  const grantedModules = roleRecord.module_access || [];
  for (const mod of grantedModules) {
    if (MODULE_PAGES[mod]?.includes(pageKey)) return true;
  }
  return false;
}

/**
 * React hook — loads approval rules from DB, provides helper functions.
 */
export function useApprovalRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await base44.entities.DocumentApprovalRule.filter({ is_active: true });
    setRules(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Returns true if the user's role can perform this transition.
   */
  const canPerformAction = useCallback((user, docType, fromState, toState) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const match = rules.find(r =>
      r.doc_type === docType &&
      r.from_state === fromState &&
      r.to_state === toState
    );
    if (!match) return false;
    return (match.allowed_roles || []).includes(user.role);
  }, [rules]);

  /**
   * Returns all available action buttons for this user on this document state.
   */
  const getActionsForDoc = useCallback((user, docType, currentState) => {
    if (!user) return [];
    return rules.filter(r => {
      if (!r.is_active) return false;
      if (r.doc_type !== docType) return false;
      if (r.from_state !== currentState) return false;
      if (user.role === 'admin') return true;
      return (r.allowed_roles || []).includes(user.role);
    }).sort((a, b) => (a.sort_order || 10) - (b.sort_order || 10));
  }, [rules]);

  return { rules, loading, reload: load, canPerformAction, getActionsForDoc };
}

/**
 * One-shot (non-hook) version for use in action handlers.
 * Fetches rules fresh from DB and checks permission.
 */
export async function checkApprovalPermission(userRole, docType, fromState, toState) {
  if (userRole === 'admin') return true;
  const rules = await base44.entities.DocumentApprovalRule.filter({
    doc_type: docType,
    from_state: fromState,
    to_state: toState,
    is_active: true,
  });
  if (!rules || rules.length === 0) return false;
  return (rules[0].allowed_roles || []).includes(userRole);
}

/**
 * useAppRoles — hook to load all AppRole records from DB.
 */
export function useAppRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await base44.entities.AppRole.filter({ is_active: true }, 'label');
    setRoles(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getRoleRecord = useCallback((roleKey) => {
    return roles.find(r => r.role_key === roleKey) || null;
  }, [roles]);

  const getRoleLabel = useCallback((roleKey) => {
    const r = roles.find(r => r.role_key === roleKey);
    return r?.label || roleKey || 'Unknown';
  }, [roles]);

  const getRoleColor = useCallback((roleKey) => {
    const r = roles.find(r => r.role_key === roleKey);
    return r?.color || 'slate';
  }, [roles]);

  return { roles, loading, reload: load, getRoleRecord, getRoleLabel, getRoleColor };
}