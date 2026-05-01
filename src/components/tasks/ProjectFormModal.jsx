import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import DatePickerField from '@/components/tasks/DatePickerField';

export default function ProjectFormModal({ open, onClose, user, directorEmail, directorName, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_name: '',
    project_description: '',
    start_date: '',
    end_date: '',
    is_important: false,
  });

  useEffect(() => {
    if (open) {
      setForm({
        project_name: '',
        project_description: '',
        start_date: '',
        end_date: '',
        is_important: false,
      });
    }
  }, [open]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const generateProjectNumber = async () => {
    const existing = await base44.entities.Project.list('-created_date', 1);
    if (existing.length === 0) return 'PRJ-0001';
    const last = existing[0].project_number || 'PRJ-0000';
    const num = parseInt(last.replace('PRJ-', ''), 10) || 0;
    return `PRJ-${String(num + 1).padStart(4, '0')}`;
  };

  const handleSave = async () => {
    if (!form.project_name.trim() || !form.end_date) return;
    setSaving(true);
    const projectNumber = await generateProjectNumber();
    const project = await base44.entities.Project.create({
      project_number: projectNumber,
      project_name: form.project_name.trim(),
      project_description: form.project_description.trim(),
      start_date: form.start_date || '',
      end_date: form.end_date,
      is_important: form.is_important,
      director_email: directorEmail,
      director_name: directorName,
      created_by_email: user.email,
      created_by_name: user.full_name,
      status: 'planned',
      team_member_emails: [],
    });
    setSaving(false);
    onCreated?.(project);
    onClose();
  };

  const isValid = form.project_name.trim() && form.end_date;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium text-slate-700">Project Name <span className="text-red-500">*</span></Label>
            <Input value={form.project_name} onChange={e => setField('project_name', e.target.value)}
              placeholder="e.g. Q3 Marketing Campaign" className="mt-1 h-11 text-base md:h-9 md:text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Description</Label>
            <Textarea value={form.project_description} onChange={e => setField('project_description', e.target.value)}
              placeholder="What is this project about?" className="mt-1 min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DatePickerField label="Start Date" value={form.start_date} onChange={v => setField('start_date', v)} placeholder="Optional" />
            <DatePickerField label="End Date" required value={form.end_date} onChange={v => setField('end_date', v)} placeholder="Select deadline" />
          </div>
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-red-700">Mark as Important</p>
              <p className="text-xs text-red-500">High priority project</p>
            </div>
            <Switch checked={form.is_important} onCheckedChange={v => setField('is_important', v)} />
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            Director: <strong>{directorName || directorEmail}</strong>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11">Cancel</Button>
            <Button onClick={handleSave} disabled={!isValid || saving} className="flex-1 h-11 gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}