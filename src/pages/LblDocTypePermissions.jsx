import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import DocTypePermissionMatrix from '@/components/labelling/DocTypePermissionMatrix';
import { ShieldCheck } from 'lucide-react';

export default function LblDocTypePermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-6 text-center text-slate-500">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        <p className="font-medium">Admin Access Required</p>
        <p className="text-sm">You do not have permission to manage document type permissions.</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Document Type Permissions</h1>
        <p className="text-sm text-slate-500">
          Configure which actions each role can perform on Labelling Shift Plans and Jobs
        </p>
      </div>
      <DocTypePermissionMatrix />
    </div>
  );
}