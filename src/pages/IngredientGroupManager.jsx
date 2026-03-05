import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import IngredientGroupManager from '@/components/master/IngredientGroupManager';
import { Loader2 } from 'lucide-react';

export default function IngredientGroupManagerPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (user?.role !== 'admin') return <div className="text-red-600">Admin access required</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ingredient Groups</h1>
        <p className="text-sm text-slate-500">Organize ingredients by category</p>
      </div>
      <IngredientGroupManager user={user} />
    </div>
  );
}