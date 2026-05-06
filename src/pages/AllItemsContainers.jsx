import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ContainerTypeManager from '@/components/master/ContainerTypeManager';
import { Loader2 } from 'lucide-react';

export default function AllItemsContainers() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Containers</h1>
        <p className="text-sm text-slate-500">Manage container types — bottles, cans, and packaging vessels</p>
      </div>
      <ContainerTypeManager user={user} />
    </div>
  );
}