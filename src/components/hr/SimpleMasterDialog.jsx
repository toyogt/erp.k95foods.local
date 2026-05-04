import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * Generic form dialog for master data entities.
 * fields: array of { key, label, type ('text'|'email'|'textarea'), placeholder, required, helper }
 */
export default function SimpleMasterDialog({
  open,
  title,
  fields = [],
  initialValues = {},
  onClose,
  onSubmit,
  showActiveToggle = true,
}) {
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const base = {};
      fields.forEach((f) => { base[f.key] = ''; });
      setForm({ is_active: true, ...base, ...initialValues });
      setError('');
    }
  }, [open]);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    for (const f of fields) {
      if (f.required && !String(form[f.key] || '').trim()) {
        return setError(`${f.label} is required`);
      }
    }
    setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach((f) => {
        if (typeof payload[f.key] === 'string') payload[f.key] = payload[f.key].trim();
      });
      await onSubmit(payload);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </Label>
              {f.type === 'textarea' ? (
                <textarea
                  value={form[f.key] || ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              ) : (
                <Input
                  type={f.type || 'text'}
                  value={form[f.key] || ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-11 md:h-9 text-base md:text-sm"
                />
              )}
              {f.helper && <p className="text-xs text-slate-500">{f.helper}</p>}
            </div>
          ))}

          {showActiveToggle && (
            <div className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2">
              <div>
                <Label className="text-sm text-slate-900">Active</Label>
                <p className="text-xs text-slate-500">Inactive records are hidden from dropdowns.</p>
              </div>
              <Switch
                checked={form.is_active !== false}
                onCheckedChange={(v) => update('is_active', v)}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-11 md:h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-11 md:h-9 gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}