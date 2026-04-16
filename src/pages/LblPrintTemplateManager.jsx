/**
 * LblPrintTemplateManager
 * Centralized UI for creating, editing, and managing Rynan print templates.
 * Provides POD field mapping configuration with live preview.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit2, Trash2, Copy, Loader2 } from 'lucide-react';

const ERP_FIELDS = [
  { key: 'mrp', label: 'MRP' },
  { key: 'batchNo', label: 'Batch Number' },
  { key: 'mfgDate', label: 'Manufacturing Date' },
  { key: 'expiryDate', label: 'Expiry Date' },
  { key: 'usp', label: 'USP (Cost per ml)' },
];

export default function LblPrintTemplateManager() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    template_id: '',
    name: '',
    description: '',
    middleware_template_name: '',
    field_mappings: [],
    is_active: true,
    notes: '',
  });
  const [podInput, setPodInput] = useState({ pod_field: '', label: '', erp_source: '', is_editable: true });

  // Fetch all templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['lbl-print-templates'],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
  });

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data) => {
      if (editingId) {
        return base44.entities.LblPrintTemplate.update(editingId, data);
      } else {
        return base44.entities.LblPrintTemplate.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
      toast({ title: editingId ? 'Template updated' : 'Template created' });
      resetForm();
      setOpenDialog(false);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LblPrintTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
      toast({ title: 'Template deleted' });
    },
  });

  const resetForm = () => {
    setFormData({
      template_id: '',
      name: '',
      description: '',
      middleware_template_name: '',
      field_mappings: [],
      is_active: true,
      notes: '',
    });
    setPodInput({ pod_field: '', label: '', erp_source: '', is_editable: true });
    setEditingId(null);
  };

  const handleAddPod = () => {
    if (!podInput.pod_field || !podInput.erp_source) {
      toast({ title: 'Enter POD field and ERP source', variant: 'destructive' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      field_mappings: [...prev.field_mappings, { ...podInput }],
    }));
    setPodInput({ pod_field: '', label: '', erp_source: '', is_editable: true });
  };

  const handleRemovePod = (index) => {
    setFormData(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    if (!formData.template_id || !formData.name || !formData.middleware_template_name) {
      toast({ title: 'Fill required fields', variant: 'destructive' });
      return;
    }
    mutation.mutate(formData);
  };

  const handleEdit = (template) => {
    setFormData({ ...template });
    setEditingId(template.id);
    setOpenDialog(true);
  };

  const handleClone = (template) => {
    setFormData({
      ...template,
      template_id: `${template.template_id}-COPY`,
      name: `${template.name} (Copy)`,
    });
    setEditingId(null);
    setOpenDialog(true);
  };

  if (isLoading) return <div className="p-4 text-slate-500">Loading templates...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Print Template Manager</h1>
          <Button className="h-11 gap-2 bg-purple-600 hover:bg-purple-700" onClick={() => { resetForm(); setOpenDialog(true); }}>
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </div>

        {/* Templates List */}
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No templates created yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {templates.map(template => (
              <div key={template.id} className="bg-white rounded-lg border border-slate-200 p-4 md:p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
                    <p className="text-sm text-slate-600">ID: <span className="font-mono">{template.template_id}</span></p>
                    <p className="text-sm text-slate-600">Middleware: <span className="font-mono">{template.middleware_template_name}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleClone(template)} title="Clone">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleEdit(template)} title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(template.id)} title="Delete">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                {template.description && <p className="text-sm text-slate-700">{template.description}</p>}

                {/* POD Mappings Table */}
                {template.field_mappings?.length > 0 ? (
                  <div className="border-t border-slate-100 pt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">POD Field</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">Label</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">ERP Source</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">Editable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.field_mappings.map((mapping, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-2 font-mono text-slate-900">{mapping.pod_field}</td>
                            <td className="py-2 px-2 text-slate-600">{mapping.label}</td>
                            <td className="py-2 px-2 font-mono text-slate-600">{mapping.erp_source}</td>
                            <td className="py-2 px-2">{mapping.is_editable ? '✓' : '✗'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No POD fields configured</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create Print Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template ID */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Template ID <span className="text-red-500">*</span></Label>
              <Input
                value={formData.template_id}
                onChange={e => setFormData(prev => ({ ...prev, template_id: e.target.value }))}
                placeholder="e.g. TMPL-DEMO-01"
                disabled={!!editingId}
                className="h-9 text-sm"
              />
              <p className="text-xs text-slate-500">Unique identifier. Cannot be changed after creation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. 200ml Demo Label"
                  className="h-9 text-sm"
                />
              </div>

              {/* Middleware Template Name */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Middleware Template Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.middleware_template_name}
                  onChange={e => setFormData(prev => ({ ...prev, middleware_template_name: e.target.value }))}
                  placeholder="e.g. Default-1"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-slate-500">Must match Rynan middleware template name exactly.</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What is this template used for?"
                className="h-20 text-sm"
              />
            </div>

            {/* POD Field Mappings */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">POD Field Mappings</h3>

              {formData.field_mappings.length > 0 && (
                <table className="w-full text-xs border border-slate-200 rounded">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left p-2 font-semibold">POD Field</th>
                      <th className="text-left p-2 font-semibold">Label</th>
                      <th className="text-left p-2 font-semibold">ERP Source</th>
                      <th className="text-center p-2 w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.field_mappings.map((m, i) => (
                      <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-2 font-mono">{m.pod_field}</td>
                        <td className="p-2">{m.label}</td>
                        <td className="p-2 font-mono text-slate-600">{m.erp_source}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => handleRemovePod(i)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
                <p className="text-xs font-medium text-slate-700">Add POD Mapping</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={podInput.pod_field}
                    onChange={e => setPodInput(prev => ({ ...prev, pod_field: e.target.value }))}
                    placeholder="e.g. POD1"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={podInput.label}
                    onChange={e => setPodInput(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Label"
                    className="h-8 text-xs"
                  />
                </div>
                <Select value={podInput.erp_source} onValueChange={v => setPodInput(prev => ({ ...prev, erp_source: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ERP source" /></SelectTrigger>
                  <SelectContent>
                    {ERP_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" className="w-full h-8 text-xs" onClick={handleAddPod}>Add Mapping</Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                className="h-16 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={mutation.isPending} className="gap-2">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}