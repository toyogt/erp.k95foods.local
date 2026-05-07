import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import AccessDenied from '@/components/AccessDenied';
import WorkstationManager from '@/components/printmanagement/WorkstationManager';
import PrintServerConfigManager from '@/components/printmanagement/PrintServerConfigManager';
import WorkstationFallbackManager from '@/components/printmanagement/WorkstationFallbackManager';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';

export default function PrintManagementAdmin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;
  if (user?.role !== 'admin') return <AccessDenied page="PrintManagementAdmin" />;

  const seed = async () => {
    if (!confirm('Seed sample workstations, configs, and fallback chain? Existing entries with the same IDs will be updated.')) return;
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('printSeedSampleData', {});
      toast({ title: 'Sample data seeded', description: JSON.stringify(res.data?.seeded || {}) });
    } catch (e) {
      toast({ title: 'Seed failed', description: e.message, variant: 'destructive' });
    } finally { setSeeding(false); }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/PrintManagementDashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Print Management — Admin</h1>
            <p className="text-xs md:text-sm text-slate-500">Workstations, server configs, and fallback rules</p>
          </div>
        </div>
        <Button variant="outline" className="h-11 md:h-9 gap-2 text-sm" onClick={seed} disabled={seeding}>
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Seed Sample Data
        </Button>
      </div>

      <Tabs defaultValue="workstations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workstations">Workstations</TabsTrigger>
          <TabsTrigger value="configs">Server Configs</TabsTrigger>
          <TabsTrigger value="fallbacks">Fallbacks</TabsTrigger>
        </TabsList>
        <TabsContent value="workstations"><WorkstationManager /></TabsContent>
        <TabsContent value="configs"><PrintServerConfigManager /></TabsContent>
        <TabsContent value="fallbacks"><WorkstationFallbackManager /></TabsContent>
      </Tabs>
    </div>
  );
}