import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function ProcessForm({ process, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: process?.name || '',
    description: process?.description || '',
    category: process?.category || '',
    trigger_type: process?.trigger_type || 'manual',
    trigger_source: process?.trigger_source || '',
    trigger_webhook_key: process?.trigger_webhook_key || '',
    is_active: process?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (process?.id) {
        await base44.entities.Process.update(process.id, form);
      } else {
        await base44.entities.Process.create(form);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Process Name *</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required
          className="mt-1" placeholder="e.g. Purchase Requisition" />
      </div>
      <div>
        <Label className="text-sm font-medium">Description</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)}
          className="mt-1" rows={2} placeholder="What does this process do?" />
      </div>
      <div>
        <Label className="text-sm font-medium">Category</Label>
        <Input value={form.category} onChange={e => set('category', e.target.value)}
          className="mt-1" placeholder="e.g. Purchase, HR, Finance" />
      </div>
      <div>
        <Label className="text-sm font-medium">Trigger Type</Label>
        <Select value={form.trigger_type} onValueChange={v => set('trigger_type', v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual — started by a user</SelectItem>
            <SelectItem value="auto">Auto — triggered by external app</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.trigger_type === 'auto' && (
        <>
          <div>
            <Label className="text-sm font-medium">Trigger Source</Label>
            <Input value={form.trigger_source} onChange={e => set('trigger_source', e.target.value)}
              className="mt-1" placeholder="e.g. FactoryFlow" />
          </div>
          <div>
            <Label className="text-sm font-medium">Webhook Key (optional)</Label>
            <Input value={form.trigger_webhook_key} onChange={e => set('trigger_webhook_key', e.target.value)}
              className="mt-1" placeholder="Secret key for validation" />
          </div>
        </>
      )}
      <div className="flex items-center gap-3">
        <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
        <Label className="text-sm">Active</Label>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[48px]">
          {saving ? 'Saving…' : process?.id ? 'Update Process' : 'Create Process'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-[48px]">
          Cancel
        </Button>
      </div>
    </form>
  );
}