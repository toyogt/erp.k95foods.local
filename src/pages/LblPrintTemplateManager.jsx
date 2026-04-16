/**
 * LblPrintTemplateManager
 * 
 * Single unified page for building Rynan print templates with POD field mappings.
 * Templates are created here and automatically available in SKU Setup via SKUPrintMapping.
 * 
 * Flow:
 * 1. Create/Edit template with middleware name and POD field mappings
 * 2. Template auto-appears in SKU Setup when SKUPrintMapping is created
 * 3. During label plan creation, user selects template for the job
 * 4. During print, POD mappings are used to auto-populate label data
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
import { Plus, Edit2, Trash2, Copy, Loader2, Info } from 'lucide-react';

const ERP_FIELDS = [
  // Product & SKU Info
  { key: 'sku_code', label: 'Product Code (SKU)' },
  { key: 'product_name', label: 'Product Name' },
  { key: 'brand_name', label: 'Brand Name' },
  { key: 'flavour', label: 'Flavour' },
  { key: 'bottle_type', label: 'Bottle Type' },
  
  // Pricing & Tax
  { key: 'mrp', label: 'MRP (Price)' },
  { key: 'mrp_with_usp', label: 'MRP with USP' },
  { key: 'usp', label: 'USP (Cost per ml)' },
  { key: 'hsn_code', label: 'HSN Code' },
  { key: 'tax_percent', label: 'Tax Percentage' },
  
  // Batch & Dates
  { key: 'batch_no', label: 'Batch Number' },
  { key: 'batch_seq', label: 'Batch Sequence' },
  { key: 'mfg_date', label: 'Manufacturing Date (DD/MM/YYYY)' },
  { key: 'manufacturing_date', label: 'Manufacturing Date' },
  { key: 'expiry_date', label: 'Expiry Date (DD/MM/YYYY)' },
  { key: 'shelf_life', label: 'Shelf Life' },
  
  // Quantity & Volume
  { key: 'ml_per_bottle', label: 'Volume per Bottle (ml)' },
  { key: 'bottles_per_box', label: 'Bottles per Box' },
  { key: 'quantity_bottles', label: 'Quantity (Bottles)' },
  { key: 'quantity_cases', label: 'Quantity (Cases)' },
  
  // Regulatory & Info
  { key: 'fssai_no', label: 'FSSAI Number' },
  { key: 'manufacturer_name', label: 'Manufacturer Name' },
  { key: 'manufacturer_address', label: 'Manufacturer Address' },
  { key: 'customer_care_phone', label: 'Customer Care Phone' },
  { key: 'customer_care_email', label: 'Customer Care Email' },
  
  // Barcode & IDs
  { key: 'product_barcode', label: 'Product Barcode' },
  { key: 'box_barcode', label: 'Box Barcode' },
  { key: 'artwork_id', label: 'Artwork ID' },
  
  // Custom/Computed
  { key: 'line_id', label: 'Labelling Line ID' },
  { key: 'shift_type', label: 'Shift (Day/Night)' },
  { key: 'labelling_date', label: 'Labelling Date' },
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Info */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Rynan Print Template Builder</h1>
            <Button className="h-11 gap-2 bg-purple-600 hover:bg-purple-700" onClick={() => { resetForm(); setOpenDialog(true); }}>
              <Plus className="w-4 h-4" /> New Template
            </Button>
          </div>
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              Templates defined here are automatically available in SKU Setup. Link templates to products via <strong>SKU Setup → Printing & Batch</strong>, then select during label plan creation.
            </p>
          </div>
        </div>

        {/* Templates List */}
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No templates created yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map(template => (
              <div key={template.id} className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
                {/* Template Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-medium">Template ID:</span> <span className="font-mono">{template.template_id}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-medium">Middleware:</span> <span className="font-mono">{template.middleware_template_name}</span>
                    </p>
                    {template.description && (
                      <p className="text-sm text-slate-700 mt-2">{template.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" onClick={() => handleClone(template)} title="Clone template">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleEdit(template)} title="Edit template">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(template.id)} title="Delete template">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                {/* POD Field Mappings */}
                {template.field_mappings?.length > 0 ? (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">POD Field Mappings</p>
                    <div className="grid gap-2">
                      {template.field_mappings.map((mapping, i) => (
                        <div key={i} className="bg-slate-50 rounded p-2.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-slate-900">{mapping.pod_field}</span>
                            <span className="text-xs text-slate-600">{mapping.label}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-600">
                              Maps to: <span className="font-mono text-slate-900">{mapping.erp_source}</span>
                            </span>
                            <span className="text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {mapping.is_editable ? 'Editable' : 'Read-only'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                    ⚠ No POD field mappings configured. Add mappings to use this template.
                  </div>
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
            <DialogTitle className="flex items-center gap-2">
              {editingId ? 'Edit Print Template' : 'Create Print Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template ID */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Template ID <span className="text-red-500">*</span></Label>
              <Input
                value={formData.template_id}
                onChange={e => setFormData(prev => ({ ...prev, template_id: e.target.value }))}
                placeholder="e.g. TMPL-200ML-01"
                disabled={!!editingId}
                className="h-9 text-sm"
              />
              <p className="text-xs text-slate-500">Unique internal identifier. Cannot change after creation.</p>
            </div>

            {/* Name and Middleware Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Template Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. 200ml Standard Label"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-slate-500">Human-readable name for this template</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Rynan Template Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.middleware_template_name}
                  onChange={e => setFormData(prev => ({ ...prev, middleware_template_name: e.target.value }))}
                  placeholder="e.g. Default-1"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-slate-500">Exact name from your Rynan printer</p>
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