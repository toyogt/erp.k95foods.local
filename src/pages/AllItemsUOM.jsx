import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import UOMMasterManager from '@/components/master/UOMMasterManager';
import UOMImportModal from '@/components/store/UOMImportModal';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';

export default function AllItemsUOM() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Units of Measure</h1>
          <p className="text-sm text-slate-500">Manage units of measure for all items</p>
        </div>
        <Button onClick={() => setShowImport(true)} variant="outline" className="h-11 text-sm gap-2">
          <Upload className="w-4 h-4" /> Import from Excel
        </Button>
      </div>
      <UOMMasterManager key={refreshKey} user={user} />
      {showImport && (
        <UOMImportModal
          onClose={() => setShowImport(false)}
          onImported={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}