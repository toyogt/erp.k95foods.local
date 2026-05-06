import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, CheckCircle2, X, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AllItemsFlavours() {
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [flavours, setFlavours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingShortCode, setEditingShortCode] = useState(null);
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

  const familiesForBrand = (brand) => families.filter(f => f.brand_name === brand);

  const addFlavour = async () => {
    if (!newFlavour.brand || !newFlavour.family || !newFlavour.name.trim()) return;
    await base44.entities.FlavourMaster.create({
      brand_name: newFlavour.brand,
      family_name: newFlavour.family,
      flavour_name: newFlavour.name.trim(),
      is_active: true,
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

  const filtered = flavours.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.flavour_name?.toLowerCase().includes(q) || f.brand_name?.toLowerCase().includes(q) || f.family_name?.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Flavours</h1>
        <p className="text-sm text-slate-500">Manage flavour variants across brands and families</p>
      </div>

      {/* Add Form */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-bold text-slate-700">Add New Flavour</p>
        <div className="grid grid-cols-1 gap-3">
          <select
            value={newFlavour.brand}
            onChange={e => setNewFlavour({ brand: e.target.value, family: '', name: '' })}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm h-11"
          >
            <option value="">— Select Brand —</option>
            {brands.map(b => <option key={b.id} value={b.brand_name}>{b.brand_name}</option>)}
          </select>
          {newFlavour.brand && (
            <select
              value={newFlavour.family}
              onChange={e => setNewFlavour({ ...newFlavour, family: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm h-11"
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
              className="h-11 text-base"
              onKeyDown={e => e.key === 'Enter' && addFlavour()}
            />
          )}
        </div>
        <Button onClick={addFlavour} disabled={!newFlavour.brand || !newFlavour.family || !newFlavour.name.trim()} className="w-full h-11 text-sm gap-2">
          <Plus className="w-4 h-4" /> Add Flavour
        </Button>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9 h-9" placeholder="Search flavours…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.length === 0 && <p className="text-center text-slate-400 py-8">No flavours found</p>}
        {filtered.map(flav => (
          <Card key={flav.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-slate-900">{flav.flavour_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{flav.brand_name} › {flav.family_name}</p>
                {flav.short_code && <p className="text-xs font-mono bg-slate-100 text-slate-600 inline-block px-2 py-0.5 rounded mt-1">Code: {flav.short_code}</p>}
              </div>
              <div className="flex items-center gap-2">
                {editingShortCode?.id === flav.id ? (
                  <>
                    <Input
                      value={editingShortCode.value}
                      onChange={e => setEditingShortCode({ ...editingShortCode, value: e.target.value.toUpperCase() })}
                      placeholder="3 letters"
                      maxLength={3}
                      className="h-8 w-20 text-xs font-mono"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        await base44.entities.FlavourMaster.update(flav.id, { short_code: editingShortCode.value });
                        setEditingShortCode(null);
                        toast.success('Code saved');
                        await loadAll();
                      }}
                      className="h-8"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingShortCode(null)} className="h-8">
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingShortCode({ id: flav.id, value: flav.short_code || '' })}
                      className="h-8 text-xs"
                    >
                      {flav.short_code ? 'Edit Code' : 'Add Code'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteFlavour(flav.id)} className="h-8">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}