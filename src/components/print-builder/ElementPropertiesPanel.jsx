/**
 * ElementPropertiesPanel
 * Shows and allows editing of the selected element's properties:
 * position (x/y), size (w/h), font size, font weight, alignment, color.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings, Trash2 } from 'lucide-react';

export default function ElementPropertiesPanel({ element, onChange, onRemove }) {
  if (!element) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 mt-8">
        <Settings className="w-6 h-6 mx-auto mb-2 text-slate-300" />
        Select an element on the canvas to edit its properties
      </div>
    );
  }

  const set = (key, val) => onChange({ [key]: val });
  const setNum = (key, val) => onChange({ [key]: parseFloat(val) || 0 });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Properties</p>
          <p className="text-xs text-purple-600 font-mono mt-0.5 truncate">{element.label || element.field}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:bg-red-50"
          onClick={onRemove}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* POD Field assignment */}
      {element.type === 'text' && (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">POD Field (e.g. POD1)</Label>
          <Input
            value={element.pod_field || ''}
            onChange={e => set('pod_field', e.target.value)}
            placeholder="POD1, POD2..."
            className="h-8 text-xs font-mono"
          />
          <p className="text-xs text-slate-400">Rynan middleware field name</p>
        </div>
      )}

      {/* Static text content */}
      {element.type === 'static' && (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Text Content</Label>
          <Input
            value={element.staticText || ''}
            onChange={e => set('staticText', e.target.value)}
            placeholder="Your text here..."
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* Position */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1.5">Position (%)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Left (X)</Label>
            <Input type="number" value={element.x} step={0.5} min={0} max={95}
              onChange={e => setNum('x', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Top (Y)</Label>
            <Input type="number" value={element.y} step={0.5} min={0} max={95}
              onChange={e => setNum('y', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1.5">Size (%)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Width</Label>
            <Input type="number" value={element.w} step={0.5} min={5} max={100}
              onChange={e => setNum('w', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Height</Label>
            <Input type="number" value={element.h} step={0.5} min={2} max={80}
              onChange={e => setNum('h', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Typography — only for text elements */}
      {(element.type === 'text' || element.type === 'static') && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">Typography</p>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Font Size (pt)</Label>
            <Input type="number" value={element.fontSize || 10} min={6} max={72}
              onChange={e => setNum('fontSize', e.target.value)} className="h-8 text-xs" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Font Weight</Label>
            <Select value={element.fontWeight || 'normal'} onValueChange={v => set('fontWeight', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="600">Semi-bold</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Alignment</Label>
            <Select value={element.align || 'left'} onValueChange={v => set('align', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Centre</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Colour */}
      {element.type !== 'divider' && element.type !== 'box' && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Text Colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={element.color || '#000000'}
              onChange={e => set('color', e.target.value)}
              className="h-8 w-10 rounded border border-slate-200 cursor-pointer"
            />
            <Input
              value={element.color || '#000000'}
              onChange={e => set('color', e.target.value)}
              className="h-8 text-xs font-mono flex-1"
            />
          </div>
        </div>
      )}

      {/* Divider-specific */}
      {element.type === 'divider' && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Line Thickness (px)</Label>
          <Input type="number" value={element.lineHeight || 1} min={1} max={10}
            onChange={e => setNum('lineHeight', e.target.value)} className="h-8 text-xs" />
        </div>
      )}

      {/* Box-specific */}
      {element.type === 'box' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Border Width (px)</Label>
            <Input type="number" value={element.borderWidth || 1} min={1} max={10}
              onChange={e => setNum('borderWidth', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Border Radius (px)</Label>
            <Input type="number" value={element.borderRadius || 0} min={0} max={20}
              onChange={e => setNum('borderRadius', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Border Colour</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={element.color || '#000000'}
                onChange={e => set('color', e.target.value)} className="h-8 w-10 rounded border border-slate-200 cursor-pointer" />
              <Input value={element.color || '#000000'} onChange={e => set('color', e.target.value)} className="h-8 text-xs font-mono flex-1" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}