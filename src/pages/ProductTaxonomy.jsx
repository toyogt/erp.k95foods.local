import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Save, X, Upload, FileUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductTaxonomy() {
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [flavours, setFlavours] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newBrand, setNewBrand] = useState('');
  const [newFamily, setNewFamily] = useState({ brand: '', name: '' });
  const [newFlavour, setNewFlavour] = useState({ brand: '', family: '', name: '' });
  
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

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

  const downloadTemplate = () => {
    const csvContent = `brand_name,family_name,flavour_name
Toyo Kombucha,Low Sugar,Exotic Peach
Toyo Kombucha,Low Sugar,Tangy Lemon
Toyo Kombucha,Regular,Classic Ginger`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'taxonomy_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file: importFile });
      const file_url = uploadRes.file_url;

      // Fetch and parse CSV manually
      const response = await fetch(file_url);
      const text = await response.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        toast.error('File is empty or has no data rows');
        setImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const brandIdx = headers.indexOf('brand_name');
      const familyIdx = headers.indexOf('family_name');
      const flavourIdx = headers.indexOf('flavour_name');

      if (brandIdx === -1) {
        toast.error('Missing required column: brand_name');
        setImporting(false);
        return;
      }

      let imported = 0;
      const processedBrands = new Set();
      const processedFamilies = new Set();
      const processedFlavours = new Set();

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const brandName = cols[brandIdx];
        const familyName = familyIdx !== -1 ? cols[familyIdx] : '';
        const flavourName = flavourIdx !== -1 ? cols[flavourIdx] : '';

        if (!brandName) continue;

        // Import brand
        if (!processedBrands.has(brandName)) {
          const exists = brands.find(b => b.brand_name === brandName);
          if (!exists) {
            await base44.entities.BrandMaster.create({ brand_name: brandName, is_active: true });
            imported++;
          }
          processedBrands.add(brandName);
        }

        // Import family
        if (familyName) {
          const famKey = `${brandName}|${familyName}`;
          if (!processedFamilies.has(famKey)) {
            const exists = families.find(f => f.brand_name === brandName && f.family_name === familyName);
            if (!exists) {
              await base44.entities.ProductFamilyMaster.create({ 
                brand_name: brandName, 
                family_name: familyName, 
                is_active: true 
              });
              imported++;
            }
            processedFamilies.add(famKey);
          }
        }

        // Import flavour
        if (familyName && flavourName) {
          const flavKey = `${brandName}|${familyName}|${flavourName}`;
          if (!processedFlavours.has(flavKey)) {
            const exists = flavours.find(f => 
              f.brand_name === brandName && 
              f.family_name === familyName && 
              f.flavour_name === flavourName
            );
            if (!exists) {
              await base44.entities.FlavourMaster.create({ 
                brand_name: brandName, 
                family_name: familyName, 
                flavour_name: flavourName, 
                is_active: true 
              });
              imported++;
            }
            processedFlavours.add(flavKey);
          }
        }
      }

      toast.success(`Imported ${imported} items successfully`);
      setImportDialog(false);
      setImportFile(null);
      loadAll();
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Taxonomy</h1>
          <p className="text-sm text-slate-500">Manage brands, families, and flavours hierarchy</p>
        </div>
        <Button onClick={() => setImportDialog(true)} className="h-11 gap-2">
          <Upload className="w-5 h-5" />Import
        </Button>
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

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Taxonomy Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold">Supported file formats:</p>
                <Button variant="ghost" size="sm" onClick={downloadTemplate} className="h-8 -mt-1 text-blue-700 hover:text-blue-900 hover:bg-blue-100">
                  <Download className="w-4 h-4 mr-1" />Template
                </Button>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>CSV, Excel (.xlsx), or JSON</li>
                <li>Required columns: <code className="bg-blue-100 px-1 rounded">brand_name</code></li>
                <li>Optional: <code className="bg-blue-100 px-1 rounded">family_name</code>, <code className="bg-blue-100 px-1 rounded">flavour_name</code></li>
              </ul>
              <p className="mt-2 text-xs">Existing records will be skipped automatically</p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-slate-400 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.json"
                onChange={e => setImportFile(e.target.files[0])}
                className="hidden"
                id="taxonomy-import-file"
              />
              <label htmlFor="taxonomy-import-file" className="cursor-pointer">
                <FileUp className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                {importFile ? (
                  <p className="text-sm font-medium text-slate-900">{importFile.name}</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-700">Click to upload file</p>
                    <p className="text-xs text-slate-500 mt-1">CSV, Excel, or JSON</p>
                  </div>
                )}
              </label>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={!importFile || importing} className="flex-1 h-12">
                {importing ? 'Importing...' : 'Import Data'}
              </Button>
              <Button variant="outline" onClick={() => { setImportDialog(false); setImportFile(null); }} className="h-12">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}