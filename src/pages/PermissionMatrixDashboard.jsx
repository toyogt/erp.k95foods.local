import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Shield } from 'lucide-react';
import PermissionMatrixTable from '@/components/admin/PermissionMatrixTable';

export default function PermissionMatrixDashboard() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [accessRules, setAccessRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.AppRole.filter({ is_active: true }, 'label'),
      base44.entities.DocumentAccessRule.filter({ is_active: true }),
    ]).then(([me, rolesData, rulesData]) => {
      setUser(me);
      setRoles(rolesData);
      setAccessRules(rulesData);
      setLoading(false);
    });
  }, []);

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Permission Matrix</h1>
      </div>
      <p className="text-slate-600">View CRUD permissions for all document types across roles</p>
      <PermissionMatrixTable roles={roles} accessRules={accessRules} />
    </div>
  );
}