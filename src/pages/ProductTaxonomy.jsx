import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductTaxonomy() {
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [flavours, setFlavours] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newBrand, setNewBrand] = useState('');
  const [newFamily, setNewFamily] = useState({ brand: '', name: '' });
  const [newFlavour, setNewFlavour] = useState({ brand: '', family: '', name: '' });

  const loadAll = async () => {
    setLoading(true);
    const [b, f, fl] = await Promise.all([
      base44.entities.BrandMaster.filter({ is_active: true }),
      base44.entities.ProductFamilyMaster.filter({ is_active: true }),
      base44.entities.FlavourMaster.filter({ is_active: true }),
    ]);
    setBrands(b);
    setFamilies(f);
    setFlavours(fl);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    await base44.entities.BrandMaster.create({ brand_name: newBrand.trim(), is_active: true });
    toast.success('Brand added');
    setNewBrand('');
    loadAll();
  };

  const deleteBrand = async (id) => {
    if (!confirm('Delete this brand?')) return;
    await base44.entities.BrandMaster.delete(id);
    toast.success('Deleted');
    loadAll();
  };

  const addFamily = async () => {
    if (!newFamily.brand || !newFamily.name.trim()) return;
    await base44.entities.ProductFamilyMaster.create({ 
      brand_name: newFamily.brand, 
      family_name: newFamily.name.trim(), 
      is_active: true 
    });
    toast.success('Family added');
    setNewFamily({ brand: '', name: '' });
    loadAll();
  };

  const deleteFamily = async (id) => {
    if (!confirm('Delete this family?')) return;
    await base44.entities.ProductFamilyMaster.delete(id);
    toast.success('Deleted');
    loadAll();
  };

  const addFlavour = async () => {
    if (!newFlavour.brand || !newFlavour.family || !newFlavour.name.trim()) return;
    await base44.entities.FlavourMaster.create({ 
      brand_name: newFlavour.brand, 
      family_name: newFlavour.family, 
      flavour_name: newFlavour.name.trim(), 
      is_active: true 
    });
    toast.success('Flavour added');
    setNewFlavour({ brand: '', family: '', name: '' });
    loadAll();
  };

  const deleteFlavour = async (id) => {
    if (!confirm('Delete this flavour?')) return;
    await base44.entities.FlavourMaster.delete(id);
    toast.success('Deleted');
    loadAll();
  };

  const familiesForBrand = (brand) => families.filter(f => f.brand_name === brand);
  const flavoursForFamily = (brand, family) => flavours.filter(f => f.brand_name === brand && f.family_name === family);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Taxonomy</h1>
        <p className="text-sm text-slate-500">Manage brands, families, and flavours hierarchy</p>
      </div>

      <Tabs defaultValue="brands" className="w-full">
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="families">Families</TabsTrigger>
          <TabsTrigger value="flavours">Flavours</TabsTrigger>
        </TabsList>

        {/* BRANDS */}
        <TabsContent value="brands" className="space-y-4">
          <Card className="p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">Add New Brand</p>
            <div className="flex gap-2">
              <Input 
                value={newBrand} 
                onChange={e => setNewBrand(e.target.value)} 
                placeholder="e.g. Toyo Kombucha"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && addBrand()}
              />
              <Button onClick={addBrand} disabled={!newBrand.trim()}><Plus className="w-4 h-4 mr-2" />Add</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {brands.map(brand => (
              <Card key={brand.id} className="p-4 flex items-center justify-between">
                <p className="font-semibold text-slate-900">{brand.brand_name}</p>
                <Button variant="ghost" size="sm" onClick={() => deleteBrand(brand.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </Card>
            ))}
            {brands.length === 0 && <p className="text-center text-slate-400 py-8">No brands yet</p>}
          </div>
        </TabsContent>

        {/* FAMILIES */}
        <TabsContent value="families" className="space-y-4">
          <Card className="p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">Add New Product Family</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select 
                value={newFamily.brand} 
                onChange={e => setNewFamily({ ...newFamily, brand: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Select Brand —</option>
                {brands.map(b => <option key={b.id} value={b.brand_name}>{b.brand_name}</option>)}
              </select>
              <Input 
                value={newFamily.name} 
                onChange={e => setNewFamily({ ...newFamily, name: e.target.value })} 
                placeholder="e.g. Low Sugar"
                onKeyDown={e => e.key === 'Enter' && addFamily()}
              />
            </div>
            <Button onClick={addFamily} disabled={!newFamily.brand || !newFamily.name.trim()} className="w-full">
              <Plus className="w-4 h-4 mr-2" />Add Family
            </Button>
          </Card>

          <div className="space-y-4">
            {brands.map(brand => {
              const fams = familiesForBrand(brand.brand_name);
              if (fams.length === 0) return null;
              return (
                <div key={brand.id} className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">{brand.brand_name}</p>
                  {fams.map(fam => (
                    <Card key={fam.id} className="p-4 flex items-center justify-between">
                      <p className="font-medium text-slate-900">{fam.family_name}</p>
                      <Button variant="ghost" size="sm" onClick={() => deleteFamily(fam.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </Card>
                  ))}
                </div>
              );
            })}
            {families.length === 0 && <p className="text-center text-slate-400 py-8">No families yet</p>}
          </div>
        </TabsContent>

        {/* FLAVOURS */}
        <TabsContent value="flavours" className="space-y-4">
          <Card className="p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">Add New Flavour</p>
            <div className="grid grid-cols-1 gap-3">
              <select 
                value={newFlavour.brand} 
                onChange={e => setNewFlavour({ brand: e.target.value, family: '', name: '' })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Select Brand —</option>
                {brands.map(b => <option key={b.id} value={b.brand_name}>{b.brand_name}</option>)}
              </select>
              {newFlavour.brand && (
                <select 
                  value={newFlavour.family} 
                  onChange={e => setNewFlavour({ ...newFlavour, family: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Select Family —</option>
                  {familiesForBrand(newFlavour.brand).map(f => (
                    <option key={f.id} value={f.family_name}>{f.family_name}</option>
                  ))}
                </select>
              )}
              {newFlavour.family && (
                <Input 
                  value={newFlavour.name} 
                  onChange={e => setNewFlavour({ ...newFlavour, name: e.target.value })} 
                  placeholder="e.g. Exotic Peach"
                  onKeyDown={e => e.key === 'Enter' && addFlavour()}
                />
              )}
            </div>
            <Button onClick={addFlavour} disabled={!newFlavour.brand || !newFlavour.family || !newFlavour.name.trim()} className="w-full">
              <Plus className="w-4 h-4 mr-2" />Add Flavour
            </Button>
          </Card>

          <div className="space-y-4">
            {brands.map(brand => {
              const fams = familiesForBrand(brand.brand_name);
              return fams.map(fam => {
                const flavs = flavoursForFamily(brand.brand_name, fam.family_name);
                if (flavs.length === 0) return null;
                return (
                  <div key={`${brand.id}-${fam.id}`} className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">{brand.brand_name} › {fam.family_name}</p>
                    {flavs.map(flav => (
                      <Card key={flav.id} className="p-4 flex items-center justify-between">
                        <p className="font-medium text-slate-900">{flav.flavour_name}</p>
                        <Button variant="ghost" size="sm" onClick={() => deleteFlavour(flav.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </Card>
                    ))}
                  </div>
                );
              });
            })}
            {flavours.length === 0 && <p className="text-center text-slate-400 py-8">No flavours yet</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}