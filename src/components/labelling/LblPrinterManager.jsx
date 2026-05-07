import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { getRynanMiddlewareSnapshot } from '@/lib/rynanPrinterService';
import { Plus, Pencil, Loader2, Save, Printer, Trash2, Download } from 'lucide-react';

const EMPTY_FORM = {
  printer_id: '', name: '', line_id: '', line_name: '',
  register_app_link: '', api_endpoint: '',
  auth_header_key: '', auth_header_value: '',
  request_timeout_ms: 15000,
  ip_address: '', port: 2030,
  demo_template: '', bulk_template: '', default_template: '',
  default_priority: 'normal', send_retries: 1,
  is_active: true, notes: '',
};

export default function LblPrinterManager({ userRole = 'user' }) {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fetchingPrinters, setFetchingPrinters] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const canEdit = true;

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ['lbl-printers-master'],
    queryFn: () => base44.entities.LblPrinterConfig.list('-created_date', 100),
  });
  const { data: lines = [] } = useQuery({
    queryKey: ['labelling-lines-master'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });

  const openNew = () => { setForm(EMPTY_FORM); setDetectedPrinters([]); setErrors({}); setEditModal('new'); };
  const openEdit = (p) => {
    setForm({
      printer_id: p.printer_id, name: p.name, line_id: p.line_id || '', line_name: p.line_name || '',
      register_app_link: p.register_app_link || '', api_endpoint: p.api_endpoint || '',
      auth_header_key: p.auth_header_key || '', auth_header_value: p.auth_header_value || '',
      request_timeout_ms: p.request_timeout_ms || 15000,
      ip_address: p.ip_address || '', port: p.port || 2030,
      demo_template: p.demo_template || '', bulk_template: p.bulk_template || '',
      default_template: p.default_template || '',
      default_priority: p.default_priority || 'normal',
      send_retries: p.send_retries || 1,
      is_active: p.is_active !== false, notes: p.notes || '',
    });
    setDetectedPrinters([]);
    setErrors({});
    setEditModal(p.id);
  };

  const handleLineChange = (lineId) => {
    const line = lines.find(l => l.id === lineId);
    setForm(f => ({ ...f, line_id: lineId, line_name: line?.display_name || '' }));
  };

  const handleFetchPrinters = async () => {
    const baseUrl = form.register_app_link || form.api_endpoint;
    if (!baseUrl) { toast({ title: 'Enter a middleware URL first', variant: 'destructive' }); return; }
    setFetchingPrinters(true);
    try {
      const snap = await getRynanMiddlewareSnapshot({ ...form, register_app_link: baseUrl });
      const list = snap.printers;
      if (!list || !Array.isArray(list)) {
        toast({ title: 'No printers returned', description: snap.printersError || 'Middleware returned no printer list', variant: 'destructive' });
        setDetectedPrinters([]);
      } else {
        setDetectedPrinters(list);
        toast({ title: `${list.length} printer(s) detected from middleware` });
      }
    } catch (err) {
      toast({ title: 'Could not reach middleware', description: err.message, variant: 'destructive' });
    }
    setFetchingPrinters(false);
  };

  const handleSelectDetectedPrinter = (dp) => {
    setForm(f => ({
      ...f,
      printer_id: dp.printer_id || dp.id || f.printer_id,
      ip_address: dp.ip || dp.ip_address || f.ip_address,
      port: dp.port || f.port,
    }));
    toast({ title: 'Printer details filled from middleware' });
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.printer_id.trim()) newErrors.printer_id = 'Printer ID is required';
    if (!form.name.trim()) newErrors.name = 'Printer Name is required';
    // Middleware URL only required for new printers
    if (editModal === 'new' && !form.register_app_link.trim() && !form.api_endpoint.trim()) newErrors.register_app_link = 'Middleware URL is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: 'Please fix the errors below', variant: 'destructive' });
      return;
    }
    setErrors({});
    setSaving(true);
    const data = {
      ...form,
      connection_type: 'api',
      status: 'idle',
      port: form.port ? Number(form.port) : 2030,
      request_timeout_ms: Number(form.request_timeout_ms) || 15000,
      send_retries: Number(form.send_retries) || 1,
    };
    if (editModal === 'new') {
      const exists = printers.find(p => p.printer_id.toLowerCase() === form.printer_id.trim().toLowerCase());
      if (exists) { toast({ title: 'Duplicate Printer ID', variant: 'destructive' }); setSaving(false); return; }
      await base44.entities.LblPrinterConfig.create(data);
    } else {
      await base44.entities.LblPrinterConfig.update(editModal, data);
    }
    queryClient.invalidateQueries({ queryKey: ['lbl-printers-master'] });
    toast({ title: editModal === 'new' ? 'Printer Added' : 'Printer Updated' });
    setEditModal(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.LblPrinterConfig.delete(deleteTarget);
    queryClient.invalidateQueries({ queryKey: ['lbl-printers-master'] });
    toast({ title: 'Printer Deleted' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Printer Configuration ({printers.length})</h2>
        {canEdit && <Button className="h-11 md:h-9 gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Add Printer</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : printers.length === 0 ? (
        <div className="text-center py-8 bg-white border border-slate-200 rounded-lg">
          <Printer className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No printers configured</p>
          <p className="text-xs text-slate-400 mt-1">Add your first printer to enable label printing</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="text-left px-4 py-3 font-medium">Printer ID</th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Assigned Line</th>
                  <th className="text-left px-4 py-3 font-medium">Middleware URL</th>
                  <th className="text-left px-4 py-3 font-medium">IP:Port</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printers.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => canEdit && openEdit(p)}>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{p.printer_id}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.line_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono truncate max-w-[180px]">{p.register_app_link || p.api_endpoint || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{p.ip_address ? `${p.ip_address}:${p.port || 2030}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>}
                        {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-slate-100">
            {printers.map(p => (
              <button key={p.id} className="w-full text-left p-4 hover:bg-slate-50" onClick={() => canEdit && openEdit(p)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-slate-900">{p.printer_id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.is_active !== false ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.line_name || 'Unassigned'} · {p.ip_address ? `${p.ip_address}:${p.port || 2030}` : 'No IP'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit / New Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editModal === 'new' ? 'Add Printer' : 'Edit Printer'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Basic Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Printer ID <span className="text-red-500">*</span></Label>
                <Input value={form.printer_id} onChange={e => { setForm(f => ({ ...f, printer_id: e.target.value })); setErrors(er => ({ ...er, printer_id: '' })); }} placeholder="e.g. PRT-01" className={`h-11 md:h-9 ${errors.printer_id ? 'border-red-500' : ''}`} />
                {errors.printer_id && <p className="text-xs text-red-600">{errors.printer_id}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Printer Name <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }} placeholder="e.g. Label Printer 1" className={`h-11 md:h-9 ${errors.name ? 'border-red-500' : ''}`} />
                {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
              </div>
            </div>

            {/* Line Assignment */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Assigned Labelling Line</Label>
              <Select value={form.line_id} onValueChange={handleLineChange}>
                <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select labelling line" /></SelectTrigger>
                <SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.machine_id} — {l.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Middleware URLs */}
            <div className="space-y-3 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Middleware Connection</p>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Primary Middleware URL {editModal === 'new' && <span className="text-red-500">*</span>}</Label>
                <Input value={form.register_app_link} onChange={e => { setForm(f => ({ ...f, register_app_link: e.target.value })); setErrors(er => ({ ...er, register_app_link: '' })); }} placeholder="http://192.168.1.50:8080" className={`h-11 md:h-9 font-mono text-sm ${errors.register_app_link ? 'border-red-500' : ''}`} />
                {errors.register_app_link && <p className="text-xs text-red-600">{errors.register_app_link}</p>}
                <p className="text-xs text-slate-500">The service will auto-append /print for print commands</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Fallback API Endpoint (Optional)</Label>
                <Input value={form.api_endpoint} onChange={e => setForm(f => ({ ...f, api_endpoint: e.target.value }))} placeholder="http://backup:8080" className="h-11 md:h-9 font-mono text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Auth Header Key</Label>
                  <Input value={form.auth_header_key} onChange={e => setForm(f => ({ ...f, auth_header_key: e.target.value }))} placeholder="X-Api-Key" className="h-11 md:h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Auth Header Value</Label>
                  <Input value={form.auth_header_value} onChange={e => setForm(f => ({ ...f, auth_header_value: e.target.value }))} placeholder="secret-token" className="h-11 md:h-9" type="password" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Request Timeout (ms)</Label>
                  <Input type="number" value={form.request_timeout_ms} onChange={e => setForm(f => ({ ...f, request_timeout_ms: e.target.value }))} className="h-11 md:h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Send Retries (max 5)</Label>
                  <Input type="number" value={form.send_retries} min="1" max="5" onChange={e => setForm(f => ({ ...f, send_retries: e.target.value }))} className="h-11 md:h-9" />
                </div>
              </div>
            </div>

            {/* Fetch from middleware */}
            <div className="space-y-2">
              <Button variant="outline" className="h-11 md:h-9 gap-2 w-full" onClick={handleFetchPrinters} disabled={fetchingPrinters}>
                {fetchingPrinters ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Fetch Printers from Middleware
              </Button>
              {detectedPrinters.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  <p className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50">{detectedPrinters.length} printer(s) detected — click to auto-fill</p>
                  {detectedPrinters.map((dp, i) => (
                    <button key={i} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm" onClick={() => handleSelectDetectedPrinter(dp)}>
                      <span className="font-mono font-medium">{dp.printer_id || dp.id || `Printer ${i + 1}`}</span>
                      {(dp.ip || dp.ip_address) && <span className="ml-2 text-slate-500">{dp.ip || dp.ip_address}:{dp.port || 2030}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Printer IP/Port */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">IP Address</Label>
                <Input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} placeholder="192.168.1.100" className="h-11 md:h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Port</Label>
                <Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="2030" className="h-11 md:h-9" />
              </div>
            </div>

            {/* Templates */}
            <div className="space-y-3 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Label Templates</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Demo Template</Label>
                  <Input value={form.demo_template} onChange={e => setForm(f => ({ ...f, demo_template: e.target.value }))} placeholder="demo_v1" className="h-11 md:h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Bulk Template</Label>
                  <Input value={form.bulk_template} onChange={e => setForm(f => ({ ...f, bulk_template: e.target.value }))} placeholder="bulk_v1" className="h-11 md:h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Default Template</Label>
                  <Input value={form.default_template} onChange={e => setForm(f => ({ ...f, default_template: e.target.value }))} placeholder="default_v1" className="h-11 md:h-9" />
                </div>
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Default Priority</Label>
                <Select value={form.default_priority} onValueChange={v => setForm(f => ({ ...f, default_priority: v }))}>
                  <SelectTrigger className="h-11 md:h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-5">
                <Label className="text-xs font-medium text-slate-700">Active</Label>
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." className="min-h-[60px]" />
            </div>

            <Button className="h-11 w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Printer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Printer?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this printer configuration.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11 md:h-9 bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}