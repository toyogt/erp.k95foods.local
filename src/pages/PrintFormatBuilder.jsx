/**
 * PrintFormatBuilder
 * Visual drag-and-drop label layout designer.
 * Saves page_size + elements onto an LblPrintTemplate record.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import PageSizePanel from '@/components/print-builder/PageSizePanel';
import CanvasEditor from '@/components/print-builder/CanvasEditor';
import ElementPalette from '@/components/print-builder/ElementPalette';
import ElementPropertiesPanel from '@/components/print-builder/ElementPropertiesPanel';
import { Save, Eye, EyeOff, LayoutTemplate } from 'lucide-react';

const DEFAULT_PAGE = { width: 100, height: 150, unit: 'mm' };

let _idCounter = 1;
const newId = () => `el_${Date.now()}_${_idCounter++}`;

export default function PrintFormatBuilder() {
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE);
  const [elements, setElements] = useState([]);
  const [selectedElId, setSelectedElId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // ── Load all active templates ──
  const { data: templates = [] } = useQuery({
    queryKey: ['lbl-print-templates-all'],
    queryFn: () => base44.entities.LblPrintTemplate.list(),
  });

  // ── When a template is selected, load its stored layout ──
  const handleSelectTemplate = (tid) => {
    setSelectedTemplateId(tid);
    const tpl = templates.find(t => t.id === tid);
    if (!tpl) return;
    if (tpl.page_size) setPageSize(tpl.page_size);
    if (Array.isArray(tpl.elements) && tpl.elements.length > 0) {
      setElements(tpl.elements.map(el => ({ ...el, _id: el._id || newId() })));
    } else {
      setElements([]);
    }
    setSelectedElId(null);
  };

  // ── Add element from palette ──
  const handleAddElement = useCallback((fieldDef) => {
    const el = {
      _id: newId(),
      field: fieldDef.key,
      label: fieldDef.label,
      type: fieldDef.type === 'static' ? 'static'
          : fieldDef.type === 'divider' ? 'divider'
          : fieldDef.type === 'box' ? 'box'
          : fieldDef.type === 'barcode' ? 'barcode'
          : fieldDef.type === 'qr' ? 'qr'
          : 'text',
      x: 5, y: Math.min(90, elements.length * 8 + 5),
      w: fieldDef.type === 'barcode' ? 40 : fieldDef.type === 'qr' ? 20 : 60,
      h: fieldDef.type === 'barcode' ? 12 : fieldDef.type === 'qr' ? 20 : 8,
      fontSize: 10,
      fontWeight: 'normal',
      color: '#000000',
      align: 'left',
    };
    setElements(prev => [...prev, el]);
    setSelectedElId(el._id);
  }, [elements.length]);

  // ── Update element property ──
  const handleChange = useCallback((id, updates) => {
    setElements(prev => prev.map(el => el._id === id ? { ...el, ...updates } : el));
  }, []);

  // ── Remove element ──
  const handleRemove = useCallback((id) => {
    setElements(prev => prev.filter(el => el._id !== id));
    setSelectedElId(null);
  }, []);

  const selectedEl = elements.find(el => el._id === selectedElId) || null;

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplateId) throw new Error('Select a template first');
      // Build field_mappings for backward compatibility
      const fieldMappings = elements
        .filter(el => el.type === 'text' && el.pod_field && el.field)
        .map(el => ({
          pod_field: el.pod_field,
          label: el.label,
          erp_source: el.field,
          is_editable: true,
        }));
      return base44.entities.LblPrintTemplate.update(selectedTemplateId, {
        page_size: pageSize,
        elements,
        field_mappings: fieldMappings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lbl-print-templates-all'] });
      toast({ title: 'Layout saved', description: 'Print format updated successfully.' });
    },
    onError: (err) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 h-13 py-2 bg-white border-b border-slate-200 shrink-0">
        <LayoutTemplate className="w-5 h-5 text-purple-600 shrink-0" />
        <h1 className="text-sm font-semibold text-slate-900 shrink-0">Print Format Builder</h1>

        <div className="flex-1 max-w-xs">
          <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a template to edit…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => setShowPreview(v => !v)}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Edit Mode' : 'Preview'}
          </Button>
          <Button
            size="sm"
            className="h-9 gap-2 bg-purple-600 hover:bg-purple-700"
            onClick={() => saveMutation.mutate()}
            disabled={!selectedTemplateId || saveMutation.isPending}
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Layout'}
          </Button>
        </div>
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Field palette + page size */}
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0">
          <PageSizePanel pageSize={pageSize} onChange={setPageSize} />
          <ElementPalette onAdd={handleAddElement} />
        </div>

        {/* Centre: Canvas */}
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center bg-slate-100">
          {!selectedTemplateId ? (
            <div className="mt-24 text-center text-slate-400">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Select a template above to start designing its layout.</p>
            </div>
          ) : (
            <CanvasEditor
              pageSize={pageSize}
              elements={elements}
              selectedId={selectedElId}
              onSelect={setSelectedElId}
              onChange={handleChange}
              onRemove={handleRemove}
              showPreview={showPreview}
            />
          )}
        </div>

        {/* Right: Properties panel */}
        <div className="w-56 bg-white border-l border-slate-200 overflow-y-auto shrink-0">
          <ElementPropertiesPanel
            element={selectedEl}
            onChange={(updates) => selectedElId && handleChange(selectedElId, updates)}
            onRemove={() => selectedElId && handleRemove(selectedElId)}
          />
        </div>
      </div>
    </div>
  );
}