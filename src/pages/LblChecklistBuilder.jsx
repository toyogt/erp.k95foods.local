import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, GripVertical, Loader2, Save } from 'lucide-react';

const PURPOSES = [{ value: 'demo_print_approval', label: 'Demo Print Approval' }, { value: 'line_start', label: 'Line Start' }, { value: 'line_end', label: 'Line End' }, { value: 'shift_handover', label: 'Shift Handover' }, { value: 'quality_check', label: 'Quality Check' }];
const ITEM_TYPES = [{ value: 'yes_no', label: 'Yes / No' }, { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'dropdown', label: 'Dropdown' }, { value: 'image', label: 'Image Upload' }];

export default function LblChecklistBuilder() {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('demo_print_approval');
  const [items, setItems] = useState([]);

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['lbl-checklist-templates'], queryFn: () => base44.entities.LblChecklistTemplate.list('-created_date', 100) });

  const openNew = () => { setName(''); setDescription(''); setPurpose('demo_print_approval'); setItems([]); setEditModal('new'); };
  const openEdit = (t) => { setName(t.name); setDescription(t.description || ''); setPurpose(t.purpose); setItems(t.items_json || []); setEditModal(t.id); };
  const addItem = () => setItems(prev => [...prev, { question: '', type: 'yes_no', required: true, options: [] }]);
  const updateItem = (idx, field, value) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { name, description, purpose, items_json: items, is_active: true };
    if (editModal === 'new') { data.template_id = `CKT-${Date.now()}`; await base44.entities.LblChecklistTemplate.create(data); }
    else { await base44.entities.LblChecklistTemplate.update(editModal, data); }
    queryClient.invalidateQueries({ queryKey: ['lbl-checklist-templates'] });
    toast({ title: 'Template Saved' }); setEditModal(null); setSaving(false);
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between"><div><h1 className="text-xl md:text-2xl font-bold text-slate-900">Checklist Templates</h1><p className="text-sm text-slate-500">Configure checklists for labelling operations</p></div><Button className="h-11 md:h-9 gap-2" onClick={openNew}><Plus className="w-4 h-4" /> New Template</Button></div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : templates.length === 0 ? <div className="text-center py-12 bg-white border border-slate-200 rounded-lg text-slate-500">No templates yet</div> : (
        <div className="space-y-3">{templates.map(t => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(t)}>
            <div><p className="font-semibold text-slate-900 text-sm">{t.name}</p><p className="text-xs text-slate-500">{PURPOSES.find(p => p.value === t.purpose)?.label} · {(t.items_json || []).length} items</p></div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        ))}</div>
      )}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editModal === 'new' ? 'New Template' : 'Edit Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-11 md:h-9" /></div>
              <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Purpose</Label><Select value={purpose} onValueChange={setPurpose}><SelectTrigger className="h-11 md:h-9"><SelectValue /></SelectTrigger><SelectContent>{PURPOSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="h-11 md:h-9" /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-slate-900">Items ({items.length})</Label><Button variant="outline" size="sm" className="h-8 gap-1" onClick={addItem}><Plus className="w-3 h-3" /> Add</Button></div>
              {items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2"><GripVertical className="w-4 h-4 text-slate-300" /><span className="text-xs font-bold text-slate-500">#{idx + 1}</span><Button variant="ghost" size="icon" className="h-6 w-6 ml-auto text-red-400" onClick={() => removeItem(idx)}><Trash2 className="w-3 h-3" /></Button></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2"><div className="md:col-span-2"><Input value={item.question} onChange={e => updateItem(idx, 'question', e.target.value)} placeholder="Question" className="h-9" /></div><Select value={item.type} onValueChange={v => updateItem(idx, 'type', v)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                  {item.type === 'dropdown' && <Input value={(item.options || []).join(', ')} onChange={e => updateItem(idx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Comma-separated options" className="h-9" />}
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={item.required} onChange={e => updateItem(idx, 'required', e.target.checked)} />Required</label>
                </div>
              ))}
            </div>
            <Button className="h-11 w-full gap-2" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}