import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Advanced masters (SKUs, Recipes, Ingredients, BoxTypes, UOMs, Artworks) live in side-menu pages
import ContainerTypeManager from '@/components/master/ContainerTypeManager';
import CapTypeManager from '@/components/master/CapTypeManager';
import LocationManager from '@/components/master/LocationManager';
import MachineManager from '@/components/master/MachineManager';
import AppSettingsManager from '@/components/master/AppSettingsManager.jsx';
import PackingWOManager from '@/components/master/PackingWOManager';
import ChecklistTemplateManager from '@/components/master/ChecklistTemplateManager';
import SyncQueueViewer from '@/components/master/SyncQueueViewer';

import ErrorMessagesManager from '@/components/master/ErrorMessagesManager';
import DowntimeReasonManager from '@/components/master/DowntimeReasonManager';
import ProductTaxonomy from '@/pages/ProductTaxonomy';
import ManufacturerManager from '@/components/master/ManufacturerManager';
import CustomerManager from '@/components/master/CustomerManager';
import SKUCustomerBarcodeManager from '@/components/master/SKUCustomerBarcodeManager';
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

      {/* Admin note: SKU Setup, Recipe Builder, Ingredients, Box Types, etc. are in the side menu */}
      {isAdmin && (
        <p className="text-xs text-slate-400">
          SKUs · Recipes · Ingredients · Box Types · UOM · Artworks · Product Taxonomy → accessible here or via side menu.
        </p>
      )}

      <Tabs defaultValue="bottles" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-10 rounded-xl bg-slate-100 p-1 min-w-full">
            {isAdmin   && <TabsTrigger value="taxonomy"      className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Taxonomy</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="manufacturers" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Manufacturers</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="customers"     className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Customers</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="sku-barcodes"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">SKU Barcodes</TabsTrigger>}
            <TabsTrigger value="bottles"    className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Containers</TabsTrigger>
            <TabsTrigger value="caps"       className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Caps</TabsTrigger>
            <TabsTrigger value="locations"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Locations</TabsTrigger>
            <TabsTrigger value="machines"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Machines</TabsTrigger>
            <TabsTrigger value="wos"        className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">WOs</TabsTrigger>
            {isManager && <TabsTrigger value="checklists" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Checklists</TabsTrigger>}
            {isManager && <TabsTrigger value="downtime"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Downtime</TabsTrigger>}

            {isAdmin   && <TabsTrigger value="syncqueue"  className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Sync Queue</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="errors"     className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Errors</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="settings"   className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3">Settings</TabsTrigger>}
          </TabsList>
        </div>
        {isAdmin   && <TabsContent value="taxonomy"      className="mt-4"><ProductTaxonomy /></TabsContent>}
        {isAdmin   && <TabsContent value="manufacturers" className="mt-4"><ManufacturerManager /></TabsContent>}
        {isAdmin   && <TabsContent value="customers"     className="mt-4"><CustomerManager /></TabsContent>}
        {isAdmin   && <TabsContent value="sku-barcodes"  className="mt-4"><SKUCustomerBarcodeManager /></TabsContent>}
        <TabsContent value="bottles"    className="mt-4"><ContainerTypeManager user={user} /></TabsContent>
        <TabsContent value="caps"       className="mt-4"><CapTypeManager user={user} /></TabsContent>
        <TabsContent value="locations"  className="mt-4"><LocationManager user={user} /></TabsContent>
        <TabsContent value="machines"   className="mt-4"><MachineManager user={user} /></TabsContent>
        <TabsContent value="wos"        className="mt-4"><PackingWOManager /></TabsContent>
        {isManager && <TabsContent value="checklists" className="mt-4"><ChecklistTemplateManager /></TabsContent>}
        {isManager && <TabsContent value="downtime"   className="mt-4"><DowntimeReasonManager /></TabsContent>}

        {isAdmin   && <TabsContent value="syncqueue"  className="mt-4"><SyncQueueViewer /></TabsContent>}
        {isAdmin   && <TabsContent value="errors"     className="mt-4"><ErrorMessagesManager /></TabsContent>}
        {isAdmin   && <TabsContent value="settings"   className="mt-4"><AppSettingsManager user={user} /></TabsContent>}
      </Tabs>
    </div>
  );
}