/**
 * React Hook for permission checks
 * Simplifies permission queries in components
 */

import { useCallback, useEffect, useState } from 'react';
import {
  canAccessModule,
  canAccessPage,
  canPerformAction,
  canViewField,
  canEditField,
  getAccessibleModules,
  clearPermissionCache,
} from './permissionResolver';

export function usePermissions(user) {
  const [perms, setPerms] = useState({
    canAccess: () => false,
    canAct: () => false,
    canView: () => true,
    canEdit: () => false,
    getModules: () => [],
  });

  useEffect(() => {
    if (!user) return;

    // Preload modules for this user
    getAccessibleModules(user).then(modules => {
      setPerms(prev => ({ ...prev, accessibleModules: modules }));
    });
  }, [user?.role]);

  const canAccessModule = useCallback(async (moduleKey) => {
    return canAccessModule(user, moduleKey);
  }, [user]);

  const canAccessPage = useCallback(async (pageKey) => {
    return canAccessPage(user, pageKey);
  }, [user]);

  const canPerformAction = useCallback(async (actionKey, entityType, docStatus) => {
    return canPerformAction(user, actionKey, entityType, docStatus);
  }, [user]);

  const canViewField = useCallback(async (entityType, fieldName) => {
    return canViewField(user, entityType, fieldName);
  }, [user]);

  const canEditField = useCallback(async (entityType, fieldName) => {
    return canEditField(user, entityType, fieldName);
  }, [user]);

  return {
    canAccessModule,
    canAccessPage,
    canPerformAction,
    canViewField,
    canEditField,
    clearCache: clearPermissionCache,
  };
}