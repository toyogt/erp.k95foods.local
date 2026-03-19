import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MRWizard from '@/components/purchase/MRWizard';
import MRList from '@/components/purchase/MRList';

export default function MaterialRequest() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMRWizard, setShowMRWizard] = useState(false);
  const [mrListKey, setMrListKey] = useState(0);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Material Requests</h1>
        <p className="text-sm text-slate-500">Create and manage material requisitions</p>
      </div>

      {!showMRWizard && (
        <Button onClick={() => setShowMRWizard(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 h-11">
          <Plus className="w-4 h-4 mr-2" /> New Material Request
        </Button>
      )}

      {showMRWizard && (
        <MRWizard
          user={user}
          onDone={() => { setShowMRWizard(false); setMrListKey(k => k + 1); }}
          onCancel={() => setShowMRWizard(false)}
        />
      )}

      {!showMRWizard && (
        <MRList
          key={mrListKey}
          user={user}
          isManager={isManager}
          onCreatePO={() => {}}
        />
      )}
    </div>
  );
}