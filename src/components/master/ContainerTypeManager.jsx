import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Package, Pencil, Upload, FileText } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function ContainerTypeManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ 
    container_type: '', 
    ml_per_container: '', 
    colour: '',
    vendor_nickname: '',
    bottles_per_crate: '',
    datasheet_url: ''
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.ContainerType.list('auto_generated_name');
    setItems(data);
    setLoading(false);
  }

  function generateName() {
    const { container_type, ml_per_container, colour, vendor_nickname } = form;
    if (!container_type || !ml_per_container || !colour || !vendor_nickname) return '';
    return `${ml_per_container}ml ${colour} ${container_type} - ${vendor_nickname}`;
  }

  function generateCode() {
    const { container_type, ml_per_container, colour } = form;
    if (!container_type || !ml_per_container || !colour) return '';
    const typePrefix = container_type === 'Glass Bottle' ? 'GB' : 'CAN';
    const colourPrefix = colour === 'Transparent' ? 'T' : 'A';
    return `${typePrefix}-${ml_per_container}${colourPrefix}`;
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, datasheet_url: file_url });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const { container_type, ml_per_container, colour, vendor_nickname, bottles_per_crate } = form;
    if (!container_type || !ml_per_container || !colour || !vendor_nickname || !bottles_per_crate) return;

    const payload = {
      container_code: generateCode(),
      auto_generated_name: generateName(),
      container_type,
      ml_per_container: Number(ml_per_container),
      colour,
      vendor_nickname,
      bottles_per_crate: Number(bottles_per_crate),
    };
    if (form.datasheet_url) payload.datasheet_url = form.datasheet_url;

    if (editingId) {
      await base44.entities.ContainerType.update(editingId, payload);
      await logAudit({ action: 'Updated container type: ' + payload.auto_generated_name, entity_type: 'ContainerType', entity_id: payload.container_code, user });
    } else {
      await base44.entities.ContainerType.create(payload);
      await logAudit({ action: 'Created container type: ' + payload.auto_generated_name, entity_type: 'ContainerType', entity_id: payload.container_code, user });
    }
    setForm({ container_type: '', ml_per_container: '', colour: '', vendor_nickname: '', bottles_per_crate: '', datasheet_url: '' });
    setEditingId(null);
    setOpen(false);
    load();
  }

  function handleEdit(item) {
    setForm({ 
      container_type: item.container_type,
      ml_per_container: item.ml_per_container,
      colour: item.colour,
      vendor_nickname: item.vendor_nickname,
      bottles_per_crate: item.bottles_per_crate,
      datasheet_url: item.datasheet_url || ''
    });
    setEditingId(item.id);
    setOpen(true);
  }

  function handleCancel() {
    setForm({ container_type: '', ml_per_container: '', colour: '', vendor_nickname: '', bottles_per_crate: '', datasheet_url: '' });
    setEditingId(null);
    setOpen(false);
  }

  async function handleDelete(item) {
    await base44.entities.ContainerType.delete(item.id);
    await logAudit({ action: 'Deleted container type: ' + item.auto_generated_name, entity_type: 'ContainerType', entity_id: item.container_code, user });
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const previewName = generateName();
  const previewCode = generateCode();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5" /> Container Types
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 h-12 px-5" onClick={() => setOpen(true)}>
              <Plus className="w-5 h-5" /> Add Container
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Container Type</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2 pb-20 overflow-y-auto flex-1">
              <div>
                <Label>Container Type *</Label>
                <Select value={form.container_type} onValueChange={v => setForm({ ...form, container_type: v })}>
                  <SelectTrigger className="mt-1 h-12 rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Glass Bottle">Glass Bottle</SelectItem>
                    <SelectItem value="Can">Can</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>ML per Container *</Label>
                <Input type="number" placeholder="e.g. 200" value={form.ml_per_container} onChange={e => setForm({ ...form, ml_per_container: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>

              <div>
                <Label>Colour *</Label>
                <Select value={form.colour} onValueChange={v => setForm({ ...form, colour: v })}>
                  <SelectTrigger className="mt-1 h-12 rounded-xl">
                    <SelectValue placeholder="Select colour" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transparent">Transparent</SelectItem>
                    <SelectItem value="Amber">Amber</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Vendor/Nick Name *</Label>
                <Input placeholder="e.g. Supplier A, Premium" value={form.vendor_nickname} onChange={e => setForm({ ...form, vendor_nickname: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>

              <div>
                <Label>Containers per Crate *</Label>
                <Input type="number" placeholder="e.g. 24" value={form.bottles_per_crate} onChange={e => setForm({ ...form, bottles_per_crate: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>

              <div>
                <Label>Container Data Sheet (Optional)</Label>
                <div className="mt-1 flex gap-2">
                  <label className="flex-1">
                    <Button variant="outline" className="w-full h-12 rounded-xl" asChild disabled={uploading}>
                      <div className="cursor-pointer">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        {uploading ? 'Uploading...' : form.datasheet_url ? 'Change File' : 'Upload File'}
                      </div>
                    </Button>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx" />
                  </label>
                  {form.datasheet_url && (
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" asChild>
                      <a href={form.datasheet_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {previewName && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Auto-generated Name:</p>
                  <p className="text-sm font-bold text-slate-900">{previewName}</p>
                  <p className="text-xs text-slate-500 mt-2">SKU Code: {previewCode}</p>
                </div>
              )}

              <Button onClick={handleSave} className="w-full h-12 rounded-xl text-base" disabled={!form.container_type || !form.ml_per_container || !form.colour || !form.vendor_nickname || !form.bottles_per_crate}>
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No container types defined</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.auto_generated_name}</span>
                  {item.datasheet_url && (
                    <a href={item.datasheet_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                      <FileText className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  SKU: {item.container_code} • {item.bottles_per_crate} per crate
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg h-10 w-10">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg h-10 w-10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}