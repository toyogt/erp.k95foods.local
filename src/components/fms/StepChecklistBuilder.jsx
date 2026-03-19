import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Camera, Video, CheckSquare, AlignLeft, Hash } from 'lucide-react';

const ITEM_TYPES = [
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, desc: 'Simple yes/no tick' },
  { value: 'text', label: 'Text Input', icon: AlignLeft, desc: 'Short text answer' },
  { value: 'number', label: 'Number', icon: Hash, desc: 'Numeric value' },
  { value: 'photo', label: 'Photo Upload', icon: Camera, desc: 'Camera/photo upload' },
  { value: 'video', label: 'Video Upload', icon: Video, desc: 'Video upload' },
];

const TYPE_ICONS = {
  checkbox: CheckSquare,
  text: AlignLeft,
  number: Hash,
  photo: Camera,
  video: Video,
};

function newItem() {
  return {
    id: Math.random().toString(36).slice(2),
    label: '',
    type: 'checkbox',
    required: true,
    hint: '',
  };
}

export default function StepChecklistBuilder({ items = [], onChange }) {
  const [showHint, setShowHint] = useState({});

  const update = (id, field, value) => {
    onChange(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const remove = (id) => onChange(items.filter(it => it.id !== id));

  const add = () => onChange([...items, newItem()]);

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
          No checklist items yet. Add items below.
        </p>
      )}

      {items.map((item, idx) => {
        const Icon = TYPE_ICONS[item.type] || CheckSquare;
        return (
          <div key={item.id} className="border border-slate-200 rounded-lg bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="text-xs text-slate-400 font-medium w-5 shrink-0">{idx + 1}.</span>

              {/* Label */}
              <Input
                value={item.label}
                onChange={e => update(item.id, 'label', e.target.value)}
                placeholder="Checklist item label…"
                className="h-8 flex-1 text-sm"
              />

              {/* Type */}
              <Select value={item.type} onValueChange={v => update(item.id, 'type', v)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <Icon className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-1.5 text-xs">
                        <t.icon className="w-3 h-3" /> {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Required toggle */}
              <button
                type="button"
                onClick={() => update(item.id, 'required', !item.required)}
                className={`text-xs px-2 py-1 rounded border font-medium transition shrink-0 ${
                  item.required
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {item.required ? 'Required' : 'Optional'}
              </button>

              <button
                type="button"
                onClick={() => setShowHint(h => ({ ...h, [item.id]: !h[item.id] }))}
                className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                title="Add hint"
              >
                Hint
              </button>

              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-slate-300 hover:text-red-500 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {showHint[item.id] && (
              <Input
                value={item.hint}
                onChange={e => update(item.id, 'hint', e.target.value)}
                placeholder="Helper text shown to the user…"
                className="h-7 text-xs ml-9 border-slate-200"
              />
            )}
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full gap-2 border-dashed min-h-[44px]">
        <Plus className="w-4 h-4" /> Add Checklist Item
      </Button>
    </div>
  );
}