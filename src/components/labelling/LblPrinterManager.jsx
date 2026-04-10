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
import { toast } from '@/components/ui/use-toast';
import { Plus, Pencil, Loader2, Save, Printer } from 'lucide-react';

const EMPTY_FORM = { printer_id: '', name: '', line_id: '', line_name: '', api_endpoint: '', ip_address: '', port: '', default_template: '', is_active: true, notes: '' };

export default function LblPrinterManager() {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: printers = [], isLoading } = useQuery({ queryKey: ['lbl-printers-master'], queryFn: () => base44.entities.LblPrinterConfig.list('-created_date', 100) });
  const { data: lines = [] } = useQuery({ queryKey: ['labelling-lines-master'], queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }) });

  const openNew = () => { setForm(EMPTY_FORM); setEditModal('new'); };
  const openEdit = (p) => { setForm({ printer_id: p.printer_id, name: p.name, line_id: p.line_id || '', line_name: p.line_name || '', api_endpoint: p.api_endpoint || '', ip_address: p.ip_address || '', port: p.port || '', default_template: p.default_template || '', is_active: p.is_active !== false, notes: p.notes || '' }); setEditModal(p.id); };

  const handleLineChange = (lineId) => {
    const line = lines.find(l => l.id === lineId);
    setForm(f => ({ ...f, line_id: lineId, line_name: line?.display_name || '' }));
  };

  const handleSave = async () => {
    if (!form.printer_id.trim() || !form.name.trim()) { toast({ title: 'Printer ID and Name are required', variant: 'destructive' }); return; }
    if (!form.api_endpoint.trim()) { toast({ title: 'API Endpoint is required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { ...form, connection_type: 'api', status: 'idle', port: form.port ? Number(form.port) : undefined };
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Printer Configuration ({printers.length})</h2>
        <Button className="h-11 md:h-9 gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Add Printer</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : printers.length === 0 ? (
        <div className="text-center py-8 bg-white border border-slate-200 rounded-lg"><Printer className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No printers configured</p><p className="text-xs text-slate-400 mt-1">Add your first printer to enable label printing</p></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-slate-700"><th className="text-left px-4 py-3 font-medium">Printer ID</th><th className="text-left px-4 py-3 font-medium">Name</th><th className="text-left px-4 py-3 font-medium">Assigned Line</th><th className="text-left px-4 py-3 font-medium">API Endpoint</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="px-4 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {printers.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{p.printer_id}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.line_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono truncate max-w-[200px]">{p.api_endpoint || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-slate-100">
            {printers.map(p => (
              <button key={p.id} className="w-full text-left p-4 hover:bg-slate-50" onClick={() => openEdit(p)}>
                <div className="flex items-center justify-between"><span className="font-mono text-sm font-semibold text-slate-900">{p.printer_id}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.is_active !== false ? 'Active' : 'Inactive'}</span></div>
                <p className="text-sm text-slate-600 mt-0.5">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.line_name || 'Unassigned'} · {p.api_endpoint || 'No endpoint'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editModal === 'new' ? 'Add Printer' : 'Edit Printer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Printer ID</Label><Input value={form.printer_id} onChange={e => setForm(f => ({ ...f, printer_id: e.target.value }))} placeholder="e.g. PRT-01" className="h-11 md:h-9" disabled={editModal !== 'new'} /></div>
              <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Printer Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Label Printer 1" className="h-11 md:h-9" /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Assigned Labelling Line</Label>
              <Select value={form.line_id} onValueChange={handleLineChange}>
                <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select labelling line" /></SelectTrigger>
                <SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.machine_id} — {l.display_name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-slate-500">A printer can be assigned to one line</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">API Endpoint <span className="text-red-500">*</span></Label>
              <Input value={form.api_endpoint} onChange={e => setForm(f => ({ ...f, api_endpoint: e.target.value }))} placeholder="https://printer-api.example.com/print" className="h-11 md:h-9 font-mono text-sm" />
              <p className="text-xs text-slate-500">Web application will send print data to this API endpoint</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">IP Address (Optional)</Label><Input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} placeholder="192.168.1.100" className="h-11 md:h-9" /></div>
              <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Port (Optional)</Label><Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="9100" className="h-11 md:h-9" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Default Label Template (Optional)</Label><Input value={form.default_template} onChange={e => setForm(f => ({ ...f, default_template: e.target.value }))} placeholder="Template name" className="h-11 md:h-9" /></div>
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Notes (Optional)</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." className="min-h-[60px]" /></div>
            <div className="flex items-center justify-between"><Label className="text-xs font-medium text-slate-700">Active</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
            <Button className="h-11 w-full gap-2" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Printer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}