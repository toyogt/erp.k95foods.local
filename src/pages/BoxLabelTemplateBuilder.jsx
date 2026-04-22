import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import BoxLabelCanvas from '@/components/labelling/BoxLabelCanvas';
import BoxLabelElementPanel from '@/components/labelling/BoxLabelElementPanel';
import { buildDefaultElement, generateTemplateId } from '@/lib/boxLabelHelpers';
import { build6x4SampleTemplate } from '@/lib/boxLabelSampleTemplates';
import { ArrowLeft, Type, Image as ImageIcon, Barcode, Save, Loader2, Eye, Wand2 } from 'lucide-react';

export default function BoxLabelTemplateBuilder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const id = new URLSearchParams(window.location.search).get('id');
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const [template, setTemplate] = useState({
    template_id: generateTemplateId(),
    template_name: '',
    description: '',
    page_unit: 'mm',
    page_width: 100,
    page_height: 60,
    elements: [],
    is_active: true,
  });
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: loaded } = useQuery({
    queryKey: ['box-label-template', id],
    queryFn: async () => {
      const list = await base44.entities.BoxLabelTemplate.filter({ id });
      return list[0] || null;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (loaded) setTemplate({ ...loaded, elements: loaded.elements || [] });
  }, [loaded]);

  const selectedElement = template.elements.find(e => e.id === selectedId) || null;

  const addElement = (type) => {
    const el = buildDefaultElement(type);
    setTemplate(t => ({ ...t, elements: [...t.elements, el] }));
    setSelectedId(el.id);
  };

  const updateElement = (elId, patch) => {
    setTemplate(t => ({
      ...t,
      elements: t.elements.map(e => e.id === elId ? { ...e, ...patch } : e),
    }));
  };

  const deleteElement = (elId) => {
    setTemplate(t => ({ ...t, elements: t.elements.filter(e => e.id !== elId) }));
    setSelectedId(null);
  };

  const loadSample6x4 = () => {
    if (template.elements.length > 0 && !confirm('Replace current elements with the 4×6 sample layout?')) return;
    const sample = build6x4SampleTemplate();
    setTemplate(t => ({
      ...t,
      template_name: t.template_name || '4x6 Box Label',
      page_unit: sample.page_unit,
      page_width: sample.page_width,
      page_height: sample.page_height,
      elements: sample.elements,
    }));
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (!template.template_name.trim()) {
      toast({ title: 'Template name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (id) {
        await base44.entities.BoxLabelTemplate.update(id, template);
      } else {
        await base44.entities.BoxLabelTemplate.create(template);
      }
      qc.invalidateQueries({ queryKey: ['box-label-templates'] });
      toast({ title: 'Template saved' });
      navigate('/BoxLabelTemplateManager');
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Preview with sample data
  const previewData = {
    job: {
      batch_no: 'BATCH-SAMPLE-01',
      manufacturing_date: '22/04/2026',
      labelling_date: '22/04/2026',
      quantity_bottles_planned: 12000,
      product_name: 'Sample Product',
      sku_code: 'SKU-001',
      mrp: '99.00',
      bottle_type: '500ml PET',
    },
    sku: {
      product_name: 'Sample Product',
      item_code: 'SKU-001',
      brand_name: 'Brand',
      flavour: 'Lemon',
      mrp: '99.00',
      mrp_box: '1188.00',
      bottles_per_box: 12,
      ml_per_bottle: 500,
      fssai_no: '12345678901234',
      hsn_code: '22021010',
      manufacturer_name: 'Manufacturer Pvt Ltd',
      address_1: 'Address line 1',
      address_2: 'Address line 2',
      customer_care_email: 'care@example.com',
      customer_care_phone: '+91-00000-00000',
      product_barcode: '8901234567890',
      box_barcode: '8901234567891',
    },
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-lg md:text-xl font-bold text-slate-900">
            {id ? 'Edit' : 'New'} Box Label Template
          </h1>
          <p className="text-xs text-slate-500">Drag elements on the canvas, bind dynamic fields, and save.</p>
        </div>
        <Button variant="outline" className="h-10 gap-2" onClick={() => setPreviewMode(p => !p)}>
          <Eye className="w-4 h-4" />
          {previewMode ? 'Edit' : 'Preview'}
        </Button>
        <Button className="h-10 gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left sidebar: template settings + element props */}
        <div className="space-y-3">
          {/* Template meta */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Template Name</Label>
              <Input className="h-9 text-sm" value={template.template_name} onChange={(e) => setTemplate(t => ({ ...t, template_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Input className="h-9 text-sm" value={template.description || ''} onChange={(e) => setTemplate(t => ({ ...t, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-medium text-slate-700">Unit</Label>
                <Select value={template.page_unit} onValueChange={(v) => setTemplate(t => ({ ...t, page_unit: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="inch">inch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Width</Label>
                <Input type="number" step="0.1" className="h-9 text-sm" value={template.page_width} onChange={(e) => setTemplate(t => ({ ...t, page_width: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Height</Label>
                <Input type="number" step="0.1" className="h-9 text-sm" value={template.page_height} onChange={(e) => setTemplate(t => ({ ...t, page_height: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>

          {/* Add elements */}
          {!previewMode && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700 uppercase">Add Element</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-10 gap-1 flex-col text-xs" onClick={() => addElement('text')}>
                  <Type className="w-4 h-4" /> Text
                </Button>
                <Button variant="outline" className="h-10 gap-1 flex-col text-xs" onClick={() => addElement('image')}>
                  <ImageIcon className="w-4 h-4" /> Image
                </Button>
                <Button variant="outline" className="h-10 gap-1 flex-col text-xs" onClick={() => addElement('barcode')}>
                  <Barcode className="w-4 h-4" /> Barcode
                </Button>
              </div>
              <Button variant="outline" className="h-10 w-full gap-2 text-sm mt-2 border-dashed" onClick={loadSample6x4}>
                <Wand2 className="w-4 h-4" /> Load 4×6 Sample
              </Button>
            </div>
          )}

          {/* Element properties */}
          {!previewMode && (
            <BoxLabelElementPanel
              element={selectedElement}
              onChange={updateElement}
              onDelete={deleteElement}
            />
          )}
        </div>

        {/* Canvas — sticky on desktop so it stays visible while editing */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-auto flex items-start justify-center p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-120px)]">
          <BoxLabelCanvas
            template={template}
            elements={template.elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdateElement={updateElement}
            previewData={previewMode ? previewData : null}
            readOnly={previewMode}
            scale={2.6}
          />
        </div>
      </div>
    </div>
  );
}