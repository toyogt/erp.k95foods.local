import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';

export default function ProcessForm({ process, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: process?.name || '',
    description: process?.description || '',
    trigger_type: process?.trigger_type || 'manual',
    trigger_source: process?.trigger_source || '',
    category: process?.category || '',
    is_active: process?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (process?.id) {
      await base44.entities.FMSProcess.update(process.id, form);
    } else {
      await base44.entities.FMSProcess.create({ ...form, version: 1 });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{process ? 'Edit Process' : 'New Process Template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Process Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Purchase Approval" className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What this process handles..." className="mt-1 h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Purchase, HR" className="mt-1" />
            </div>
            <div>
              <Label>Trigger Type</Label>
              <Select value={form.trigger_type} onValueChange={v => set('trigger_type', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="auto">Auto (from app)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.trigger_type === 'auto' && (
            <div>
              <Label>Trigger Source Key</Label>
              <Input value={form.trigger_source} onChange={e => set('trigger_source', e.target.value)} placeholder="e.g. gate_entry, purchase_po" className="mt-1" />
              <p className="text-xs text-slate-500 mt-1">Used by app events to auto-start this process</p>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
            <Label>Active (can be triggered)</Label>
          </div>
          <div className="flex gap-2 pt-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()} className="min-w-[100px] min-h-[44px]">
              {saving ? 'Saving…' : 'Save Process'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}