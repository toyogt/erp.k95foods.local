import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Package, Pencil, Upload, FileText, Search } from 'lucide-react';
import CreatableUOMSelect from '@/components/store/CreatableUOMSelect';
import TablePagination from '@/components/store/TablePagination';
import { logAudit } from '@/components/AuditLogger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function ContainerTypeManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState({ 
    container_type: '', 
    ml_per_container: '', 
    colour: '',
    vendor_nickname: '',
    bottles_per_crate: '',
    uom: '',
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
    if (form.uom) payload.uom = form.uom;

    if (editingId) {
      await base44.entities.ContainerType.update(editingId, payload);
      await logAudit({ action: 'Updated container type: ' + payload.auto_generated_name, entity_type: 'ContainerType', entity_id: payload.container_code, user });
    } else {
      await base44.entities.ContainerType.create(payload);
      await logAudit({ action: 'Created container type: ' + payload.auto_generated_name, entity_type: 'ContainerType', entity_id: payload.container_code, user });
    }
    setForm({ container_type: '', ml_per_container: '', colour: '', vendor_nickname: '', bottles_per_crate: '', uom: '', datasheet_url: '' });
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
      uom: item.uom || '',
      datasheet_url: item.datasheet_url || ''
    });
    setEditingId(item.id);
    setOpen(true);
  }

  function handleCancel() {
    setForm({ container_type: '', ml_per_container: '', colour: '', vendor_nickname: '', bottles_per_crate: '', uom: '', datasheet_url: '' });
    setEditingId(null);
    setOpen(false);
  }

  async function handleDelete(item) {
    await base44.entities.ContainerType.delete(item.id);
    await logAudit({ action: 'Deleted container type: ' + item.auto_generated_name, entity_type: 'ContainerType', entity_id: item.container_code, user });
    load();
  }

  const filtered = items.filter(i => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (i.auto_generated_name || '').toLowerCase().includes(q) || (i.container_code || '').toLowerCase().includes(q) || (i.vendor_nickname || '').toLowerCase().includes(q);
  });
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const previewName = generateName();
  const previewCode = generateCode();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="w-full pl-9 h-9 rounded-lg border border-slate-200 text-sm" placeholder="Search containers…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-11 px-4" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> Add Container
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Container Type</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2 pb-20 overflow-y-auto flex-1">
              <div>
                <Label>Container Type *</Label>
                <Select value={form.container_type} onValueChange={v => setForm({ ...form, container_type: v })}>
                  <SelectTrigger className="mt-1 h-12 rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
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
                  <SelectTrigger className="mt-1 h-12 rounded-xl"><SelectValue placeholder="Select colour" /></SelectTrigger>
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
                <CreatableUOMSelect value={form.uom} onChange={v => setForm({ ...form, uom: v })} />
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
                      <a href={form.datasheet_url} target="_blank" rel="noopener noreferrer"><FileText className="w-4 h-4" /></a>
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="px-3 py-2.5 text-left font-semibold">SKU Code</th>
                <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Container Name</th>
                <th className="px-3 py-2.5 text-center font-semibold">Type</th>
                <th className="px-3 py-2.5 text-center font-semibold">ML</th>
                <th className="px-3 py-2.5 text-center font-semibold">Colour</th>
                <th className="px-3 py-2.5 text-center font-semibold">Per Crate</th>
                <th className="px-3 py-2.5 text-center font-semibold">UOM</th>
                <th className="px-3 py-2.5 text-center font-semibold">Datasheet</th>
                <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{item.container_code}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{item.auto_generated_name}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{item.container_type}</td>
                  <td className="px-3 py-2.5 text-center font-bold">{item.ml_per_container}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{item.colour}</td>
                  <td className="px-3 py-2.5 text-center font-semibold">{item.bottles_per_crate}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{item.uom || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {item.datasheet_url ? (
                      <a href={item.datasheet_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700"><FileText className="w-4 h-4 inline" /></a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex gap-1 items-center justify-center">
                      <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                      <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400 text-sm">No container types found.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}