/**
 * Module Navigation Config
 * DEPRECATED: Now derived from lib/registryConfig
 * 
 * Kept for backward compatibility only.
 * Use lib/registryConfig instead for new code.
 */

import {
  LayoutDashboard, Factory, Tag, Warehouse, ShoppingCart,
  PackageOpen, CreditCard, GitBranch, Settings,
  Droplets, Thermometer, Truck, Printer, ClipboardCheck,
  Layers, BarChart3, Upload, ListChecks, Bell, ScrollText,
  Search, PlayCircle, MonitorDot, Users, FlaskConical,
  PackageSearch, Zap, Box, TestTube2, ShieldCheck,
  Archive, FileText, ClipboardList, Shield,
} from 'lucide-react';

import {
  moduleRegistry,
  pageRegistry,
  getVisibleModules as getVisibleModulesFromRegistry,
  getVisiblePagesInModule,
  getModuleForPage as getModuleForPageFromRegistry,
} from '@/lib/registryConfig';

/**
 * MODULES - Derived from registry
 * Exported for backward compatibility with existing layout code
 */
export const MODULES = moduleRegistry.map(m => ({
  key: m.moduleKey,
  label: m.label,
  icon: m.icon,
  color: m.color,
  bgColor: m.bgColor,
  pages: pageRegistry
    .filter(p => p.moduleKey === m.moduleKey)
    .map(p => ({
      key: p.pageKey,
      label: p.title,
      icon: p.icon,
      roles: p.roles,
      adminOnly: p.adminOnly,
    })),
}));

/**
 * Get module for a page (backward compat)
 */
export function getModuleForPage(pageKey) {
  return getModuleForPageFromRegistry(pageKey);
}

/**
 * Filter visible modules for role (backward compat)
 */
export function getVisibleModules(role, roleModuleAccess = null) {
  return getVisibleModulesFromRegistry(role);
}

/**
 * Get visible pages in module for role (backward compat)
 */
export function getVisiblePages(mod, role, roleModuleAccess = null) {
  return getVisiblePagesInModule(mod.key, role);
}