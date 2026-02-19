import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PAGE_MODULE_MAP, computeEffectiveModules } from './moduleHelpers';
import { getAllowedPages } from '@/components/roles';

/**
 * Returns { isEnabled(page), loading }
 * Falls back to legacy role-based access if no ModuleConfig records exist.
 */
export default function useModuleAccess(user) {
  const [effectiveModules, setEffectiveModules] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      base44.entities.ModuleConfig.list().catch(() => []),
      base44.entities.RoleModuleAccess.filter({ role: user.role || 'admin' }).catch(() => []),
      base44.entities.UserModuleOverride.filter({ user_id: user.id }).catch(() => []),
    ]).then(([moduleConfigs, roleAccesses, userOverrides]) => {
      const modules = computeEffectiveModules(moduleConfigs, roleAccesses, userOverrides, user.role || 'admin', user.id);
      setEffectiveModules(modules);
    }).finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  function isEnabled(page) {
    // If no module config exists (empty DB) → fall back to legacy
    if (!effectiveModules) {
      return getAllowedPages(user).includes(page);
    }
    // Always allow Dashboard
    if (page === 'Dashboard') return true;
    const moduleKey = PAGE_MODULE_MAP[page];
    if (!moduleKey) return getAllowedPages(user).includes(page);
    return effectiveModules.has(moduleKey) && getAllowedPages(user).includes(page);
  }

  return { isEnabled, loading };
}