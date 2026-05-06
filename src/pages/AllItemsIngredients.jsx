import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import IngredientMasterManager from '@/components/master/IngredientMasterManager';
import { Loader2 } from 'lucide-react';

export default function AllItemsIngredients() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ingredients</h1>
        <p className="text-sm text-slate-500">Manage ingredient specs, brand items, and groups</p>
      </div>
      <IngredientMasterManager user={user} />
    </div>
  );
}