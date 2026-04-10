import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { hasDocPermission, getAllowedActions } from '@/lib/docTypePermissionHelper';
import { useState, useEffect } from 'react';

/**
 * Hook to check document-type permissions for the current user.
 * Usage:
 *   const { can, allowedActions, loading } = useDocTypePermission('LabellingShiftPlan');
 *   if (can('create')) { ... }
 */
export default function useDocTypePermission(docType) {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setUserLoading(false); })
      .catch(() => setUserLoading(false));
  }, []);

  const { data: permissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['doc-type-permissions'],
    queryFn: () => base44.entities.DocTypePermission.list('-created_date', 500),
    staleTime: 60000,
  });

  const role = user?.role || 'user';
  const loading = userLoading || permsLoading;

  const can = (action) => {
    if (loading) return false;
    return hasDocPermission(permissions, role, docType, action);
  };

  const allowedActions = loading ? [] : getAllowedActions(permissions, role, docType);

  return { can, allowedActions, loading, user, role };
}