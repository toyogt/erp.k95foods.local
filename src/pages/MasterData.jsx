import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BottleTypeManager from '@/components/master/BottleTypeManager';
import LocationManager from '@/components/master/LocationManager';
import MachineManager from '@/components/master/MachineManager';
import AppSettingsManager from '@/components/master/AppSettingsManager.jsx';
import PackingWOManager from '@/components/master/PackingWOManager';
import { Loader2 } from 'lucide-react';

export default function MasterData() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Master Data</h1>
        <p className="text-sm text-slate-500">Manage bottle types, locations, and machines</p>
      </div>

      <Tabs defaultValue="bottles" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-12 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="bottles"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Bottles</TabsTrigger>
          <TabsTrigger value="locations" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Locations</TabsTrigger>
          <TabsTrigger value="machines"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Machines</TabsTrigger>
          <TabsTrigger value="wos"       className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">WOs</TabsTrigger>
          <TabsTrigger value="settings"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="bottles"   className="mt-4"><BottleTypeManager user={user} /></TabsContent>
        <TabsContent value="locations" className="mt-4"><LocationManager user={user} /></TabsContent>
        <TabsContent value="machines"  className="mt-4"><MachineManager user={user} /></TabsContent>
        <TabsContent value="wos"       className="mt-4"><PackingWOManager /></TabsContent>
        <TabsContent value="settings"  className="mt-4"><AppSettingsManager user={user} /></TabsContent>
      </Tabs>
    </div>
  );
}