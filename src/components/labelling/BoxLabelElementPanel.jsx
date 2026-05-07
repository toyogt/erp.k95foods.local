import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { DATA_FIELDS } from '@/lib/boxLabelHelpers';

/**
 * Properties panel for a selected element on the box label canvas.
 */
export default function BoxLabelElementPanel({ element, onChange, onDelete }) {
  if (!element) {
    return (
      <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        Select an element on the canvas to edit its properties, or add a new element using the buttons above.
      </div>
    );
  }

  const update = (patch) => onChange(element.id, patch);

  return (
    <div className="space-y-3 bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 uppercase">
          {element.type} Properties
        </span>
        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-8" onClick={() => onDelete(element.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Position & size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-medium text-slate-700">X</Label>
          <Input type="number" step="0.1" className="h-9 text-sm" value={element.x} onChange={(e) => update({ x: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Y</Label>
          <Input type="number" step="0.1" className="h-9 text-sm" value={element.y} onChange={(e) => update({ y: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Width</Label>
          <Input type="number" step="0.1" className="h-9 text-sm" value={element.width} onChange={(e) => update({ width: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Height</Label>
          <Input type="number" step="0.1" className="h-9 text-sm" value={element.height} onChange={(e) => update({ height: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Text element */}
      {element.type === 'text' && (
        <>
          <div>
            <Label className="text-xs font-medium text-slate-700">Dynamic Data Field</Label>
            <Select value={element.data_field || '__static__'} onValueChange={(v) => update({ data_field: v === '__static__' ? '' : v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__static__">Static text (use field below)</SelectItem>
                {DATA_FIELDS.map(f => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">Pick a field to auto-fill from job/SKU, or use static text with <code className="text-[10px]">{'{{job.batch_no}}'}</code> placeholders.</p>
          </div>
          {!element.data_field && (
            <div>
              <Label className="text-xs font-medium text-slate-700">Text Content</Label>
              <Input className="h-9 text-sm" value={element.text_content || ''} onChange={(e) => update({ text_content: e.target.value })} placeholder="e.g. Batch: {{job.batch_no}}" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs font-medium text-slate-700">Font Size</Label>
              <Input type="number" className="h-9 text-sm" value={element.font_size || 10} onChange={(e) => update({ font_size: parseFloat(e.target.value) || 10 })} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Weight</Label>
              <Select value={element.font_weight || 'normal'} onValueChange={(v) => update({ font_weight: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="800">Extra Bold</SelectItem>
                  <SelectItem value="900">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Align</Label>
              <Select value={element.text_align || 'left'} onValueChange={(v) => update({ text_align: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Color</Label>
            <Input type="color" className="h-9 text-sm w-20" value={element.color || '#000000'} onChange={(e) => update({ color: e.target.value })} />
          </div>
        </>
      )}

      {/* Image element */}
      {element.type === 'image' && (
        <div>
          <Label className="text-xs font-medium text-slate-700">Image URL</Label>
          <Input className="h-9 text-sm" value={element.image_url || ''} onChange={(e) => update({ image_url: e.target.value })} placeholder="https://..." />
          <p className="text-xs text-slate-500 mt-1">Paste a public image URL (logo, FSSAI mark, etc.)</p>
        </div>
      )}

      {/* Barcode element */}
      {element.type === 'barcode' && (
        <>
          <div>
            <Label className="text-xs font-medium text-slate-700">Barcode Type</Label>
            <Select value={element.barcode_type || 'CODE128'} onValueChange={(v) => update({ barcode_type: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">CODE128</SelectItem>
                <SelectItem value="QR">QR Code</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Data Field</Label>
            <Select value={element.data_field || ''} onValueChange={(v) => update({ data_field: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick a field" /></SelectTrigger>
              <SelectContent>
                {DATA_FIELDS.map(f => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}