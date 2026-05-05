import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import UOMImportModal from '@/components/store/UOMImportModal';
import IngredientMasterManager from '@/components/master/IngredientMasterManager';
import UOMMasterManager from '@/components/master/UOMMasterManager';
import BoxTypeManager from '@/components/master/BoxTypeManager';
import LabelArtworkManager from '@/components/master/LabelArtworkManager';
import ContainerTypeManager from '@/components/master/ContainerTypeManager';
import CapTypeManager from '@/components/master/CapTypeManager';
import { Loader2, Upload } from 'lucide-react';

const TABS = [
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'uom', label: 'Units of Measure' },
  { key: 'box-types', label: 'Box Types' },
  { key: 'label-artworks', label: 'Label Artworks' },
  { key: 'containers', label: 'Containers' },
  { key: 'caps', label: 'Caps' },
];

export default function ItemModule() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ingredients');
  const [showUOMImport, setShowUOMImport] = useState(false);
  const [uomRefreshKey, setUomRefreshKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); });
  }, []);

  // Support ?tab=xxx from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && TABS.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (user?.role !== 'admin') return <div className="p-6 text-red-600 font-medium">Admin access required</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Item Module</h1>
          <p className="text-sm text-slate-500">Manage ingredients, units, box types, artworks, containers and caps</p>
        </div>
        {activeTab === 'uom' && (
          <Button onClick={() => setShowUOMImport(true)} variant="outline" className="h-11 text-sm gap-2">
            <Upload className="w-4 h-4" /> Import from Excel
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-10 rounded-xl bg-slate-100 p-1 min-w-full">
            {TABS.map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-3 whitespace-nowrap"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="ingredients" className="mt-4">
          <IngredientMasterManager user={user} />
        </TabsContent>

        <TabsContent value="uom" className="mt-4">
          <UOMMasterManager key={uomRefreshKey} user={user} />
        </TabsContent>

        <TabsContent value="box-types" className="mt-4">
          <BoxTypeManager user={user} />
        </TabsContent>

        <TabsContent value="label-artworks" className="mt-4">
          <LabelArtworkManager user={user} />
        </TabsContent>

        <TabsContent value="containers" className="mt-4">
          <ContainerTypeManager user={user} />
        </TabsContent>

        <TabsContent value="caps" className="mt-4">
          <CapTypeManager user={user} />
        </TabsContent>
      </Tabs>

      {showUOMImport && (
        <UOMImportModal
          onClose={() => setShowUOMImport(false)}
          onImported={() => setUomRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}