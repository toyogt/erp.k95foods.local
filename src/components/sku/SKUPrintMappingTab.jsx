/**
 * SKUPrintMappingTab
 * Manage which templates are available for this SKU (for different artworks)
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, Check } from 'lucide-react';

export default function SKUPrintMappingTab({ sku }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['sku-print-mappings', sku?.id],
    queryFn: () => base44.entities.SKUPrintMapping.filter({ sku_code: sku?.item_code }),
    enabled: !!sku?.id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['available-templates'],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
  });

  const { data: artworks = [] } = useQuery({
    queryKey: ['label-artworks'],
    queryFn: () => base44.entities.LabelArtwork.filter({ is_active: true }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SKUPrintMapping.create({
      mapping_id: `MAP-${Date.now()}`,
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sku-print-mappings', sku?.id] });
      toast({ title: 'Template Added to SKU' });
      setSelectedTemplate('');
      setShowAddDialog(false);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ mappingId, isDefault }) => base44.entities.SKUPrintMapping.update(mappingId, { is_default: isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sku-print-mappings', sku?.id] });
      toast({ title: 'Default template updated' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SKUPrintMapping.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sku-print-mappings', sku?.id] });
      toast({ title: 'Mapping Removed' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (!sku?.id) return <p className="text-slate-600 text-sm">Select a SKU first</p>;

  const getTemplateName = (templateId) => templates.find(t => t.id === templateId)?.name;
  const getArtworkName = (artworkId) => artworkId ? artworks.find(a => a.id === artworkId)?.name : 'Default';

  const handleAddTemplate = () => {
    if (!selectedTemplate) {
      toast({ title: 'Select a template', variant: 'destructive' });
      return;
    }

    const selectedTpl = templates.find(t => t.id === selectedTemplate);
    const alreadyExists = mappings.some(m => m.template_id === selectedTemplate && m.artwork_id === selectedTpl.artwork_id);

    if (alreadyExists) {
      toast({ title: 'This template is already assigned to this SKU', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      sku_code: sku.item_code,
      template_id: selectedTemplate,
      artwork_id: selectedTpl.artwork_id || '',
      is_default: mappings.length === 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Available Print Templates</h3>
          <p className="text-xs text-slate-600 mt-1">Choose which templates can be used when creating label plans for this SKU</p>
        </div>
        <Button className="gap-2 h-11" onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="w-4 h-4" /> Add Template
        </Button>
      </div>

      {/* Mappings List */}
      {isLoading ? (
        <p className="text-slate-600 text-sm">Loading...</p>
      ) : mappings.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-6 text-center">
          <p className="text-slate-600 text-sm mb-3">No templates assigned yet</p>
          <Button variant="outline" className="gap-2 h-11" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4" /> Add First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map(mapping => (
            <div key={mapping.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between gap-3 border border-slate-200 hover:bg-slate-100 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{getTemplateName(mapping.template_id)}</p>
                <p className="text-xs text-slate-600 mt-0.5">Artwork: {getArtworkName(mapping.artwork_id)}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Set as Default */}
                <Button
                  variant={mapping.is_default ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1 h-8 text-xs"
                  onClick={() => setDefaultMutation.mutate({ mappingId: mapping.id, isDefault: !mapping.is_default })}
                >
                  {mapping.is_default && <Check className="w-3 h-3" />}
                  {mapping.is_default ? 'Default' : 'Set Default'}
                </Button>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-600 hover:bg-red-50"
                  onClick={() => deleteMutation.mutate(mapping.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Template Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Template to {sku?.product_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Select Template <span className="text-red-500">*</span></label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.artwork_id ? `(${artworks.find(a => a.id === tpl.artwork_id)?.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Only active templates are shown</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-11">Cancel</Button>
            <Button className="h-11" onClick={handleAddTemplate} disabled={!selectedTemplate || createMutation.isPending}>
              Add Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}