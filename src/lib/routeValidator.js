/**
 * Route Validator
 * Checks registry integrity and identifies configuration issues
 * 
 * Reports:
 * - Orphan pages (in pages.config but not in registry)
 * - Missing modules
 * - Duplicate page keys
 * - Duplicate routes
 * - Pages without module mapping
 * - Pages without role mapping
 */

import { pageRegistry, moduleRegistry, specialPages, getAllRoutablePages } from './registryConfig';

export function validateRoutes() {
  const report = {
    errors: [],
    warnings: [],
    stats: {
      totalPages: 0,
      totalModules: 0,
      orphanPages: [],
      missingModules: [],
      duplicateKeys: [],
      duplicatePaths: [],
      pagesWithoutRoles: [],
      unknownRoles: [],
    },
  };

  // Count
  const allRoutable = getAllRoutablePages();
  report.stats.totalPages = allRoutable.length;
  report.stats.totalModules = moduleRegistry.length;

  // Check 1: Duplicate page keys
  const pageKeys = allRoutable.map(p => p.pageKey);
  const duplicateKeys = pageKeys.filter((k, i) => pageKeys.indexOf(k) !== i);
  if (duplicateKeys.length > 0) {
    report.stats.duplicateKeys = [...new Set(duplicateKeys)];
    report.errors.push(
      `Duplicate page keys found: ${report.stats.duplicateKeys.join(', ')}`
    );
  }

  // Check 2: Duplicate route paths
  const paths = allRoutable.map(p => `/${p.pageKey}`);
  const duplicatePaths = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (duplicatePaths.length > 0) {
    report.stats.duplicatePaths = [...new Set(duplicatePaths)];
    report.errors.push(
      `Duplicate routes found: ${report.stats.duplicatePaths.join(', ')}`
    );
  }

  // Check 3: Pages without module mapping
  const pagesWithoutModule = pageRegistry.filter(p => !p.moduleKey);
  if (pagesWithoutModule.length > 0) {
    report.stats.pagesWithoutModule = pagesWithoutModule.map(p => p.pageKey);
    report.errors.push(
      `Pages without module mapping: ${report.stats.pagesWithoutModule.join(', ')}`
    );
  }

  // Check 4: Pages without roles
  const pagesWithoutRoles = pageRegistry.filter(p => !p.roles || p.roles.length === 0);
  if (pagesWithoutRoles.length > 0) {
    report.stats.pagesWithoutRoles = pagesWithoutRoles.map(p => p.pageKey);
    report.warnings.push(
      `Pages without role restrictions: ${report.stats.pagesWithoutRoles.join(', ')}`
    );
  }

  // Check 5: Unknown modules referenced
  const usedModules = new Set(pageRegistry.filter(p => p.moduleKey).map(p => p.moduleKey));
  const definedModules = new Set(moduleRegistry.map(m => m.moduleKey));
  const unknownModules = [...usedModules].filter(m => !definedModules.has(m));
  if (unknownModules.length > 0) {
    report.stats.missingModules = unknownModules;
    report.errors.push(
      `Pages reference undefined modules: ${unknownModules.join(', ')}`
    );
  }

  // Check 6: Unused modules (no pages)
  const unusedModules = [...definedModules].filter(m => !usedModules.has(m));
  if (unusedModules.length > 0) {
    report.warnings.push(
      `Modules with no pages: ${unusedModules.join(', ')}`
    );
  }

  // Check 7: Collect all used roles
  const allUsedRoles = new Set();
  pageRegistry.forEach(p => {
    if (p.roles) p.roles.forEach(r => allUsedRoles.add(r));
  });
  specialPages.forEach(p => {
    if (p.roles) p.roles.forEach(r => allUsedRoles.add(r));
  });

  // Check 8: Module icons validation
  moduleRegistry.forEach(m => {
    if (!m.icon) {
      report.warnings.push(`Module ${m.moduleKey} missing icon`);
    }
  });

  // Check 9: Page icons validation
  pageRegistry.forEach(p => {
    if (!p.icon) {
      report.warnings.push(`Page ${p.pageKey} missing icon`);
    }
  });

  report.stats.roles = [...allUsedRoles].sort();
  report.stats.isValid = report.errors.length === 0;

  return report;
}

/**
 * Find orphan pages not in pages.config
 * (This would need actual pages.config import to implement)
 */
export function findOrphanPages(importedPages) {
  const registryKeys = new Set(getAllRoutablePages().map(p => p.pageKey));
  const orphans = Object.keys(importedPages).filter(
    key => !registryKeys.has(key)
  );
  return orphans;
}

/**
 * Get full diagnostics report
 */
export function getDiagnosticsReport() {
  const validation = validateRoutes();
  
  return {
    timestamp: new Date().toISOString(),
    validation,
    summary: {
      totalPages: validation.stats.totalPages,
      totalModules: validation.stats.totalModules,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      isHealthy: validation.stats.isValid && validation.warnings.length === 0,
    },
    details: {
      roles: validation.stats.roles,
      modules: moduleRegistry.map(m => ({ key: m.moduleKey, label: m.label })),
      pagesByModule: moduleRegistry.map(m => ({
        module: m.moduleKey,
        count: pageRegistry.filter(p => p.moduleKey === m.moduleKey).length,
      })),
    },
  };
}