import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SKUBOMEditor from '@/components/planning/SKUBOMEditor';
import MaterialCategoryConfig from '@/components/planning/MaterialCategoryConfig';
import { Loader2, Search, Package, Settings } from 'lucide-react';

export default function SKUBOMConfig() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skus, setSkus] = useState([]);
  const [items, setItems] = useState([]);
  const [bomLines, setBomLines] = useState([]);
  const [planningCategories, setPlanningCategories] = useState([]);
  const [selectedSku, setSelectedSku] = useState(null);
  const [skuSearch, setSkuSearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [u, s, i, b, pc] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.ProductMaster.filter({ is_active: true }, '-created_date', 500),
      base44.entities.ItemMaster.list('-created_date', 500),
      base44.entities.SKUBOMLine.list('-created_date', 2000),
      base44.entities.MaterialPlanningCategory.list('-created_date', 50),
    ]);
    setUser(u);
    setSkus(s);
    setItems(i);
    setBomLines(b);
    setPlanningCategories(pc);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const reloadBOM = useCallback(async () => {
    const b = await base44.entities.SKUBOMLine.list('-created_date', 2000);
    setBomLines(b);
  }, []);

  const reloadCategories = useCallback(async () => {
    const pc = await base44.entities.MaterialPlanningCategory.list('-created_date', 50);
    setPlanningCategories(pc);
  }, []);

  const filteredSkus = skus.filter(s =>
    skuSearch === '' ||
    s.product_name?.toLowerCase().includes(skuSearch.toLowerCase()) ||
    s.item_code?.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const getBOMCount = (skuCode) => bomLines.filter(l => l.sku_code === skuCode).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Material Planning Configuration</h1>
        <p className="text-sm text-slate-500">Configure which materials each SKU needs and which categories to track for production planning.</p>
      </div>

      <Tabs defaultValue="bom" className="w-full">
        <TabsList className="h-11 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="bom" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
            <Package className="w-4 h-4" /> SKU Bill of Materials
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
            <Settings className="w-4 h-4" /> Planning Categories
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: SKU BOM */}
        <TabsContent value="bom" className="mt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* SKU List */}
            <div className="lg:w-80 xl:w-96 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={skuSearch}
                  onChange={e => setSkuSearch(e.target.value)}
                  placeholder="Search SKU..."
                  className="h-11 md:h-9 pl-10"
                />
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredSkus.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400">No active SKUs found</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredSkus.map(sku => {
                      const count = getBOMCount(sku.item_code);
                      const isSelected = selectedSku?.item_code === sku.item_code;
                      return (
                        <button
                          key={sku.id}
                          onClick={() => setSelectedSku(sku)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                          }`}
                        >
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {sku.product_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-mono ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                              {sku.item_code}
                            </span>
                            {count > 0 && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                              }`}>
                                {count} material{count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* BOM Editor */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 md:p-5">
              {selectedSku ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">{selectedSku.product_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{selectedSku.item_code}</p>
                    {selectedSku.bottle_type && (
                      <p className="text-xs text-slate-500 mt-1">
                        Container: {selectedSku.bottle_type} · {selectedSku.bottles_per_box} per box
                      </p>
                    )}
                  </div>
                  <SKUBOMEditor
                    sku={selectedSku}
                    bomLines={bomLines}
                    items={items}
                    onSaved={reloadBOM}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select an SKU from the list to configure its materials</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Planning Categories */}
        <TabsContent value="categories" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6">
            <MaterialCategoryConfig
              planningCategories={planningCategories}
              onSaved={reloadCategories}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}