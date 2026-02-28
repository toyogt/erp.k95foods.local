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
  // Keep loading=true until we have BOTH user AND module data resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If user is not yet known, stay in loading state — don't resolve early
    if (!user) return;
    setLoading(true);
    Promise.all([
      base44.entities.ModuleConfig.list().catch(() => []),
      base44.entities.RoleModuleAccess.filter({ role: user.role }).catch(() => []),
      base44.entities.UserModuleOverride.filter({ user_id: user.id }).catch(() => []),
    ]).then(([moduleConfigs, roleAccesses, userOverrides]) => {
      const modules = computeEffectiveModules(moduleConfigs, roleAccesses, userOverrides, user.role, user.id);
      setEffectiveModules(modules);
    }).finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  function isEnabled(page) {
    // roles.js ACCESS_MAP is ALWAYS the primary gate — never bypassed
    if (!getAllowedPages(user).includes(page)) return false;
    // If module configs exist, also check module-level enable/disable
    if (effectiveModules) {
      if (page === 'Dashboard') return true;
      const moduleKey = PAGE_MODULE_MAP[page];
      if (moduleKey) return effectiveModules.has(moduleKey);
    }
    // No module config in DB → role-based access alone is sufficient
    return true;
  }

  return { isEnabled, loading };
}