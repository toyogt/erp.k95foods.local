import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Link as LinkIcon, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ArtworkTab({ sku, onArtworksChanged }) {
  const [links, setLinks] = useState([]);
  const [artworks, setArtworks] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ recipe_option_id: '', artwork_id: '', is_default: false });

  useEffect(() => {
    if (sku?.item_code) loadLinks();
  }, [sku]);

  async function loadLinks() {
    if (!sku?.item_code) return;
    setLoading(true);
    const [l, a, ro] = await Promise.all([
      base44.entities.RecipeArtworkLink.filter({ sku_code: sku.item_code }).catch(() => []),
      base44.entities.LabelArtwork.filter({ is_active: true }).catch(() => []),
      base44.entities.RecipeOption.filter({ recipe_group_id: sku.recipe_group_id }).catch(() => []),
    ]);
    setLinks(l);
    setArtworks(a);
    setRecipeOptions(ro);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.recipe_option_id || !form.artwork_id) {
      toast.error('Recipe option and artwork are required');
      return;
    }
    const duplicate = links.find(l => l.recipe_option_id === form.recipe_option_id && l.artwork_id === form.artwork_id);
    if (duplicate) {
      toast.error('This combination already exists');
      return;
    }
    await base44.entities.RecipeArtworkLink.create({
      sku_code: sku.item_code,
      ...form,
      is_active: true,
    });
    toast.success('Artwork linked');
    setShowForm(false);
    setForm({ recipe_option_id: '', artwork_id: '', is_default: false });
    loadLinks();
    onArtworksChanged && onArtworksChanged();
  }

  async function handleDelete(id) {
    if (!confirm('Remove this artwork link?')) return;
    await base44.entities.RecipeArtworkLink.delete(id);
    toast.success('Link removed');
    loadLinks();
    onArtworksChanged && onArtworksChanged();
  }

  async function handleSetDefault(link) {
    await Promise.all([
      ...links.filter(l => l.recipe_option_id === link.recipe_option_id).map(l =>
        base44.entities.RecipeArtworkLink.update(l.id, { is_default: false })
      ),
      base44.entities.RecipeArtworkLink.update(link.id, { is_default: true })
    ]);
    toast.success('Default artwork updated');
    loadLinks();
  }

  if (!sku) return <div className="text-sm text-slate-400 py-8 text-center">Select or save a SKU first.</div>;
  if (!sku.recipe_group_id) return <div className="text-sm text-amber-600 py-8 text-center bg-amber-50 rounded-xl border border-amber-200 p-4">⚠️ Recipe group not configured. Set recipe group in "Recipe & Packaging" tab first.</div>;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Artwork Links for {sku.item_code}</p>
          <p className="text-xs text-slate-500 mt-0.5">Link artworks to specific recipe options</p>
        </div>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs min-h-[36px]" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3.5 h-3.5" /> Link Artwork
        </Button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Recipe Option *</Label>
              <select value={form.recipe_option_id} onChange={e => setForm(f => ({ ...f, recipe_option_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-10 bg-white">
                <option value="">— Select Recipe Option —</option>
                {recipeOptions.map(ro => <option key={ro.id} value={ro.option_id}>{ro.option_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Artwork *</Label>
              <select value={form.artwork_id} onChange={e => setForm(f => ({ ...f, artwork_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-10 bg-white">
                <option value="">— Select Artwork —</option>
                {artworks.map(a => <option key={a.id} value={a.artwork_id}>{a.artwork_name} {a.artwork_version && `(${a.artwork_version})`}</option>)}
              </select>
              {artworks.length === 0 && <p className="text-xs text-amber-600">No artworks available. Create in Label Artworks page first.</p>}
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 rounded" />
              <Label className="text-xs">Set as default for this recipe option</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-9 gap-2 text-xs min-h-[36px]" onClick={handleCreate}>
              Link Artwork
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs min-h-[36px]" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          <LinkIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No artwork links yet. Add the first one above.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map(link => {
            const artwork = artworks.find(a => a.artwork_id === link.artwork_id);
            const recipeOption = recipeOptions.find(r => r.option_id === link.recipe_option_id);
            return (
              <div key={link.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${link.is_default ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-mono font-semibold">{recipeOption?.option_name || link.recipe_option_id}</span>
                    <span className="text-xs text-slate-400">→</span>
                    <p className="text-sm font-semibold text-slate-800">{artwork?.artwork_name || link.artwork_id}</p>
                    {artwork?.artwork_version && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">{artwork.artwork_version}</span>}
                    {link.is_default && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Default</span>}
                  </div>
                  {link.notes && <p className="text-xs text-slate-400 mt-1">{link.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!link.is_default && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleSetDefault(link)}>
                      Set Default
                    </Button>
                  )}
                  <button onClick={() => handleDelete(link.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}