/**
 * LblPrintTemplateManager
 * Manage Rynan label print templates + artwork assignments
 * One template per (SKU + Artwork) combination
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit2, Trash2, Copy, Loader2 } from 'lucide-react';

export default function LblPrintTemplateManager() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    template_id: '',
    name: '',
    description: '',
    artwork_id: '',
    middleware_template_name: '',
    field_mappings: [],
    is_active: true,
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['lbl-print-templates'],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
  });

  const { data: artworks = [] } = useQuery({
    queryKey: ['label-artworks'],
    queryFn: () => base44.entities.LabelArtwork.filter({ is_active: true }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LblPrintTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
      toast({ title: 'Template Created' });
      resetForm();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LblPrintTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
      toast({ title: 'Template Updated' });
      resetForm();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LblPrintTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lbl-print-templates'] });
      toast({ title: 'Template Deleted' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormData({
      template_id: '',
      name: '',
      description: '',
      artwork_id: '',
      middleware_template_name: '',
      field_mappings: [],
      is_active: true,
      notes: '',
    });
    setEditingId(null);
    setShowDialog(false);
  };

  const handleSave = async () => {
    if (!formData.template_id || !formData.name || !formData.middleware_template_name) {
      toast({ title: 'Missing Required Fields', variant: 'destructive' });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (template) => {
    setFormData(template);
    setEditingId(template.id);
    setShowDialog(true);
  };

  const handleClone = async (template) => {
    const newId = `${template.template_id}-COPY-${Date.now()}`;
    const clonedData = { ...template, template_id: newId, name: `${template.name} (Copy)` };
    delete clonedData.id;
    delete clonedData.created_date;
    delete clonedData.updated_date;
    delete clonedData.created_by;

    createMutation.mutate(clonedData);
  };

  const getArtworkName = (artworkId) => artworks.find(a => a.id === artworkId)?.name || artworkId || '—';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Print Templates</h1>
          <p className="text-sm text-slate-600 mt-1">Manage Rynan label templates and POD field mappings</p>
        </div>
        <Button className="gap-2 h-11" onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <p className="text-slate-600 mb-4">No templates yet</p>
          <Button className="gap-2" onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="w-4 h-4" /> Create First Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{template.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{template.template_id}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(template)}>
                    <Edit2 className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleClone(template)}>
                    <Copy className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(template.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              {/* Details */}
              <div className="bg-slate-50 rounded p-2 text-xs space-y-1">
                <p><span className="font-medium text-slate-600">Middleware:</span> <span className="font-mono">{template.middleware_template_name}</span></p>
                {template.artwork_id && <p><span className="font-medium text-slate-600">Artwork:</span> {getArtworkName(template.artwork_id)}</p>}
                <p><span className="font-medium text-slate-600">POD Fields:</span> {template.field_mappings?.length || 0}</p>
              </div>

              {template.description && <p className="text-xs text-slate-600 line-clamp-2">{template.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Template ID */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Template ID <span className="text-red-500">*</span></Label>
              <Input
                value={formData.template_id}
                onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                disabled={!!editingId}
                placeholder="e.g., TK-EXPE-LS-GLS-330"
                className="h-9"
              />
              <p className="text-xs text-slate-500">Unique identifier. Cannot be changed after creation.</p>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Template Name <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Toyo Kombucha Low Sugar"
                className="h-9"
              />
            </div>

            {/* Middleware Template Name */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Middleware Template Name <span className="text-red-500">*</span></Label>
              <Input
                value={formData.middleware_template_name}
                onChange={(e) => setFormData({ ...formData, middleware_template_name: e.target.value })}
                placeholder="e.g., Default-1"
                className="h-9"
              />
              <p className="text-xs text-slate-500">Exact name used in Rynan middleware payload.</p>
            </div>

            {/* Artwork */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Artwork (Optional)</Label>
              <Select value={formData.artwork_id} onValueChange={(val) => setFormData({ ...formData, artwork_id: val })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select artwork or leave blank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {artworks.map(art => (
                    <SelectItem key={art.id} value={art.id}>{art.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this template used for?"
                className="h-20 text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="h-16 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm} className="h-11">Cancel</Button>
            <Button className="gap-2 h-11" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}