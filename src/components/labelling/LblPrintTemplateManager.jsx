import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Pencil, Trash2, Loader2, Save, FileCode2 } from 'lucide-react';
import PODFieldMappingEditor from './PODFieldMappingEditor';

const COMMAND_TYPE_LABELS = {
  demo_print: 'Demo Print',
  bulk_start: 'Bulk Start',
  bulk_stop: 'Bulk Stop',
  purge: 'Purge',
  test_ping: 'Test Ping',
  custom: 'Custom',
};



const EMPTY_FORM = {
  template_id: '',
  name: '',
  description: '',
  command_type: 'demo_print',
  middleware_template_name: '',
  field_mappings: [],
  is_active: true,
  notes: '',
};



export default function LblPrintTemplateManager() {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(null); // null | 'new' | record.id
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['lbl-print-templates'],
    queryFn: () => base44.entities.LblPrintTemplate.list('-created_date', 200),
  });

  const openNew = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditModal('new');
  };

  const openEdit = (t) => {
    setForm({
      template_id: t.template_id || '',
      name: t.name || '',
      description: t.description || '',
      command_type: t.command_type || 'demo_print',
      middleware_template_name: t.middleware_template_name || '',
      field_mappings: t.field_mappings || [],
      is_active: t.is_active !== false,
      notes: t.notes || '',
    });
    setErrors({});
    setEditModal(t.id);
  };



  const handleSave = async () => {
    const errs = {};
    if (!form.template_id.trim()) errs.template_id = 'Template ID is required';
    if (!form.name.trim()) errs.name = 'Template name is required';
    if (!form.middleware_template_name.trim()) errs.middleware_template_name = 'Middleware template name is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = { ...form };

    if (editModal === 'new') {
      const exists = templates.find(t => t.template_id.toLowerCase() === form.template_id.trim().toLowerCase());
      if (exists) {
        toast({ title: 'Duplicate Template ID', description: 'A template with this ID already exists.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      await base44.entities.LblPrintTemplate.create(payload);
      toast({ title: 'Template Created' });
    } else {
      await base44.entities.LblPrintTemplate.update(editModal, payload);
      toast({ title: 'Template Updated' });
    }

    queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
    setEditModal(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.LblPrintTemplate.delete(deleteTarget);
    queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
    toast({ title: 'Template Deleted' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Rynan Print Templates ({templates.length})
        </h2>
        <Button className="h-11 md:h-9 gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 bg-white border border-slate-200 rounded-lg">
          <FileCode2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No print templates configured</p>
          <p className="text-xs text-slate-400 mt-1">Add templates to map Rynan POD fields to your ERP data</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="text-left px-4 py-3 font-medium">Template ID</th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Command Type</th>
                  <th className="text-left px-4 py-3 font-medium">Middleware Name</th>
                  <th className="text-left px-4 py-3 font-medium">Fields</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(t)}>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">{t.template_id}</td>
                    <td className="px-4 py-3 text-slate-700">{t.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {COMMAND_TYPE_LABELS[t.command_type] || t.command_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.middleware_template_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{(t.field_mappings || []).length} fields</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {templates.map(t => (
              <button key={t.id} className="w-full text-left p-4 hover:bg-slate-50" onClick={() => openEdit(t)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-bold text-slate-900">{t.template_id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{t.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                    {COMMAND_TYPE_LABELS[t.command_type] || t.command_type}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{t.middleware_template_name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit / New Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editModal === 'new' ? 'Add Rynan Print Template' : 'Edit Rynan Print Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Template ID <span className="text-red-500">*</span></Label>
                <Input
                  value={form.template_id}
                  onChange={e => { setForm(f => ({ ...f, template_id: e.target.value })); setErrors(er => ({ ...er, template_id: '' })); }}
                  placeholder="e.g. TMPL-DEMO-01"
                  className={`h-11 md:h-9 font-mono ${errors.template_id ? 'border-red-500' : ''}`}
                  disabled={editModal !== 'new'}
                />
                {errors.template_id && <p className="text-xs text-red-600">{errors.template_id}</p>}
                <p className="text-xs text-slate-400">Unique identifier. Cannot be changed after creation.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Template Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                  placeholder="e.g. 200ml Demo Label"
                  className={`h-11 md:h-9 ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
              </div>
            </div>

            {/* Middleware name + command type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Middleware Template Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.middleware_template_name}
                  onChange={e => { setForm(f => ({ ...f, middleware_template_name: e.target.value })); setErrors(er => ({ ...er, middleware_template_name: '' })); }}
                  placeholder="e.g. Default-1"
                  className={`h-11 md:h-9 font-mono ${errors.middleware_template_name ? 'border-red-500' : ''}`}
                />
                {errors.middleware_template_name && <p className="text-xs text-red-600">{errors.middleware_template_name}</p>}
                <p className="text-xs text-slate-400">Exact name used in Rynan middleware payload.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Command Type <span className="text-red-500">*</span></Label>
                <Select value={form.command_type} onValueChange={v => setForm(f => ({ ...f, command_type: v }))}>
                  <SelectTrigger className="h-11 md:h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMMAND_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this template used for?"
                className="min-h-[60px]"
              />
            </div>

            {/* POD Field Mappings */}
            <PODFieldMappingEditor
              value={form.field_mappings}
              onChange={mappings => setForm(f => ({ ...f, field_mappings: mappings }))}
            />

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." className="min-h-[50px]" />
            </div>

            <div className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
              <Label className="text-xs font-medium text-slate-700">Active</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>

            <Button className="h-11 w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this print template. Any SKUs mapped to it will need to be re-configured.</AlertDialogDescription>
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