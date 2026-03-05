import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Image, CheckCircle2, Loader2 } from 'lucide-react';

function genId() { return 'ART-' + Date.now().toString(36).toUpperCase().slice(-5); }

export default function ArtworkTab({ sku, artworks, onArtworksChanged, onDefaultChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ artwork_name: '', artwork_version: 'v1.0', barcode: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const skuArtworks = artworks.filter(a => a.sku_code === sku?.item_code);
  const defaultId = sku?.default_artwork_id;

  const handleCreate = async () => {
    if (!form.artwork_name.trim()) return;
    setSaving(true);
    await base44.entities.LabelArtwork.create({
      artwork_id: genId(),
      sku_code: sku.item_code,
      artwork_name: form.artwork_name,
      artwork_version: form.artwork_version,
      barcode: form.barcode || sku.product_barcode || '',
      notes: form.notes,
      is_active: true,
    });
    setSaving(false);
    setShowForm(false);
    setForm({ artwork_name: '', artwork_version: 'v1.0', barcode: '', notes: '' });
    onArtworksChanged();
  };

  if (!sku) return <div className="text-sm text-slate-400 py-8 text-center">Select or save a SKU first.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Artworks for {sku.item_code}</p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3.5 h-3.5" /> Add Artwork
        </Button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Artwork Name *</Label>
              <Input value={form.artwork_name} onChange={e => setForm(f => ({ ...f, artwork_name: e.target.value }))} className="text-sm h-9" placeholder="e.g. Mango 200ml v2" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Version</Label>
              <Input value={form.artwork_version} onChange={e => setForm(f => ({ ...f, artwork_version: e.target.value }))} className="text-sm h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Barcode</Label>
              <Input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} className="text-sm h-9" placeholder={sku.product_barcode || 'auto'} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm h-9" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-9 gap-2 text-xs" onClick={handleCreate} disabled={saving || !form.artwork_name.trim()}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Artwork
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {skuArtworks.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          <Image className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No artworks yet. Add the first one above.
        </div>
      ) : (
        <div className="space-y-2">
          {skuArtworks.map(a => {
            const isDefault = a.artwork_id === defaultId;
            return (
              <div key={a.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${isDefault ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{a.artwork_name}</p>
                    {a.artwork_version && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">{a.artwork_version}</span>}
                    {isDefault && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Default</span>}
                  </div>
                  {a.barcode && <p className="text-xs text-slate-400 font-mono mt-0.5">Barcode: {a.barcode}</p>}
                  {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                </div>
                {!isDefault && (
                  <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 gap-1.5" onClick={() => onDefaultChanged(a.artwork_id)}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Set Default
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}