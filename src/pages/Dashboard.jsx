import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import AdminDashboard from '@/components/dashboard/AdminDashboard.jsx';
import OperatorDashboard from '@/components/dashboard/OperatorDashboard.jsx';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  // Use database-driven layout mapping instead of hardcoded roles
  const isOperator = ['filling_operator', 'chamber_operator', 'labelling_supervisor', 'warehouse_ops', 'line_operator', 'dispatch_officer', 'labelling_receiver', 'store_receiver', 'security_guard', 'pallet_builder', 'recipe_operator', 'qc_inspector', 'label_operator'].includes(user?.role);

  if (isOperator) return <OperatorDashboard user={user} />;
  return <AdminDashboard user={user} />;
}