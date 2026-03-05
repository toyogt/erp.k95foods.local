import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BottleTypeManager from '@/components/master/BottleTypeManager';
import LocationManager from '@/components/master/LocationManager';
import MachineManager from '@/components/master/MachineManager';
import AppSettingsManager from '@/components/master/AppSettingsManager.jsx';
import PackingWOManager from '@/components/master/PackingWOManager';
import ChecklistTemplateManager from '@/components/master/ChecklistTemplateManager';
import SyncQueueViewer from '@/components/master/SyncQueueViewer';
import ModuleAccessManager from '@/components/master/ModuleAccessManager';
import ErrorMessagesManager from '@/components/master/ErrorMessagesManager';
import DowntimeReasonManager from '@/components/master/DowntimeReasonManager';
import { Loader2 } from 'lucide-react';

export default function MasterData() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'production_manager' || isAdmin;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Master Data</h1>
        <p className="text-sm text-slate-500">Manage configuration and reference data</p>
      </div>

      <Tabs defaultValue="bottles" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-10 rounded-xl bg-slate-100 p-1 min-w-full">
            {isAdmin && <TabsTrigger value="products"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">SKUs (Adv)</TabsTrigger>}
            <TabsTrigger value="artworks"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Label Artworks</TabsTrigger>
            {isAdmin && <TabsTrigger value="ryan-tpl" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Ryan Templates</TabsTrigger>}
            <TabsTrigger value="boxtypes"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Box Types</TabsTrigger>

            <TabsTrigger value="ingredients" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Ingredients</TabsTrigger>
            <TabsTrigger value="ing-groups"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Ing. Groups</TabsTrigger>
            <TabsTrigger value="uom"         className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">UOM</TabsTrigger>
            <TabsTrigger value="bottles"    className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Bottles</TabsTrigger>
            <TabsTrigger value="locations"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Locations</TabsTrigger>
            <TabsTrigger value="machines"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Machines</TabsTrigger>
            <TabsTrigger value="wos"        className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">WOs</TabsTrigger>
            {isManager && <TabsTrigger value="checklists" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Checklists</TabsTrigger>}
            {isManager && <TabsTrigger value="modules"    className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Modules</TabsTrigger>}
            {isManager && <TabsTrigger value="syncqueue"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Sync Queue</TabsTrigger>}
            {isManager && <TabsTrigger value="errors"     className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Errors</TabsTrigger>}
            {isManager && <TabsTrigger value="downtime"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Downtime</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="settings"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Settings</TabsTrigger>}
          </TabsList>
        </div>
        {isAdmin && <TabsContent value="products"   className="mt-4"><ProductMasterManager /></TabsContent>}
        <TabsContent value="artworks"   className="mt-4"><LabelArtworkManager user={user} /></TabsContent>
        {isAdmin && <TabsContent value="ryan-tpl" className="mt-4"><RyanTemplateManager user={user} /></TabsContent>}
        <TabsContent value="boxtypes"   className="mt-4"><BoxTypeManager user={user} /></TabsContent>

        <TabsContent value="ingredients" className="mt-4"><IngredientMasterManager user={user} /></TabsContent>
        <TabsContent value="ing-groups"  className="mt-4"><IngredientGroupManager user={user} /></TabsContent>
        <TabsContent value="uom"         className="mt-4"><UOMMasterManager user={user} /></TabsContent>
        <TabsContent value="bottles"    className="mt-4"><BottleTypeManager user={user} /></TabsContent>
        <TabsContent value="locations"  className="mt-4"><LocationManager user={user} /></TabsContent>
        <TabsContent value="machines"   className="mt-4"><MachineManager user={user} /></TabsContent>
        <TabsContent value="wos"        className="mt-4"><PackingWOManager /></TabsContent>
        {isManager && <TabsContent value="checklists" className="mt-4"><ChecklistTemplateManager /></TabsContent>}
        {isManager && <TabsContent value="modules"    className="mt-4"><ModuleAccessManager /></TabsContent>}
        {isManager && <TabsContent value="syncqueue"  className="mt-4"><SyncQueueViewer /></TabsContent>}
        {isManager && <TabsContent value="errors"     className="mt-4"><ErrorMessagesManager /></TabsContent>}
        {isManager && <TabsContent value="downtime"   className="mt-4"><DowntimeReasonManager /></TabsContent>}
        {isAdmin   && <TabsContent value="settings"   className="mt-4"><AppSettingsManager user={user} /></TabsContent>}
      </Tabs>
    </div>
  );
}