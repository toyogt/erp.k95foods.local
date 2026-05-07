import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import ParameterMapper from './ParameterMapper';
import { Loader2, ArrowLeft, Send, Save } from 'lucide-react';

const ENTITIES_WITH_FIELDS = [
  // Task Management
  { name: 'DirectorTask', label: 'Director Task' },
  { name: 'Project', label: 'Project' },
  // Purchase & Procurement
  { name: 'PurchaseRequest', label: 'Purchase Request' },
  { name: 'PurchaseOrder', label: 'Purchase Order' },
  { name: 'Supplier', label: 'Supplier' },
  { name: 'SupplierInvoice', label: 'Supplier Invoice' },
  { name: 'PaymentRequest', label: 'Payment Request' },
  // Gate & Goods Receipt
  { name: 'GateEntry', label: 'Gate Entry' },
  { name: 'GRNHeader', label: 'Goods Receipt Note' },
  // Store & Inventory
  { name: 'StoreIssue', label: 'Store Issue' },
  { name: 'StoreLot', label: 'Store Lot' },
  { name: 'StoreItemMaster', label: 'Store Item Master' },
  // Production
  { name: 'ProductionOrder', label: 'Production Order' },
  { name: 'Batch', label: 'Batch' },
  { name: 'LiquidBatchPlan', label: 'Liquid Batch Plan' },
  // Quality
  { name: 'QCInspection', label: 'Quality Control Inspection' },
  // Sales & Dispatch
  { name: 'SalesOrder', label: 'Sales Order' },
  { name: 'SalesPicklist', label: 'Sales Picklist' },
  { name: 'SalesInvoice', label: 'Sales Invoice' },
  { name: 'SalesDispatch', label: 'Sales Dispatch' },
  { name: 'Customer', label: 'Customer' },
  // Labelling
  { name: 'LabellingJob', label: 'Labelling Job' },
  // Users & Roles
  { name: 'User', label: 'User' },
  { name: 'EADirectorMapping', label: 'Executive Assistant Mapping' },
];

export default function TemplateForm({ template, onBack, onSaved }) {
  const isEdit = !!template;
  const { toast } = useToast();

  const [form, setForm] = useState({
    template_name: '',
    display_name: '',
    category: 'UTILITY',
    language: 'en',
    header_text: '',
    body_text: '',
    footer_text: 'K95 ERP',
    trigger_entity: '',
    trigger_event: 'manual',
    recipient_field: '',
    phone_number_id: '',
    notes: '',
  });
  const [mappings, setMappings] = useState([]);
  const [examples, setExamples] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (template) {
      setForm({
        template_name: template.template_name || '',
        display_name: template.display_name || '',
        category: template.category || 'UTILITY',
        language: template.language || 'en',
        header_text: template.header_text || '',
        body_text: template.body_text || '',
        footer_text: template.footer_text || 'K95 ERP',
        trigger_entity: template.trigger_entity || '',
        trigger_event: template.trigger_event || 'manual',
        recipient_field: template.recipient_field || '',
        phone_number_id: template.phone_number_id || '',
        notes: template.notes || '',
      });
      setMappings(template.parameter_mappings || []);
      setExamples(template.example_values || []);
    }
  }, [template]);

  // Count parameters in body text
  const paramCount = (form.body_text.match(/\{\{\d+\}\}/g) || []).length;
  const uniqueParams = [...new Set((form.body_text.match(/\{\{\d+\}\}/g) || []).map(p => parseInt(p.replace(/[{}]/g, ''))))].sort((a, b) => a - b);

  // Sync mappings when body text params change — skip initial load for edits to preserve DB data
  useEffect(() => {
    if (isEdit && !initialLoadDone.current) {
      // On first render with a template, just mark as loaded — DB values already set
      if (uniqueParams.length > 0) initialLoadDone.current = true;
      return;
    }
    setMappings(prev => {
      const prevIndices = prev.map(m => m.index).sort((a, b) => a - b);
      if (JSON.stringify(prevIndices) === JSON.stringify(uniqueParams) && prev.length > 0) return prev;
      return uniqueParams.map(idx => {
        const existing = prev.find(m => m.index === idx);
        return existing || { index: idx, label: `Parameter ${idx}`, source_entity: form.trigger_entity, source_field: '', fallback_value: '' };
      });
    });
    setExamples(prev => {
      if (prev.length === uniqueParams.length && prev.length > 0) return prev;
      return uniqueParams.map((_idx, i) => prev[i] || '');
    });
  }, [paramCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.template_name.trim() || !form.body_text.trim()) {
      toast({ title: 'Error', description: 'Template name and body text are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const data = {
      ...form,
      parameter_count: uniqueParams.length,
      parameter_mappings: mappings,
      example_values: examples,
      is_active: true,
    };

    if (isEdit) {
      await base44.entities.WhatsAppTemplate.update(template.id, data);
    } else {
      data.meta_status = 'draft';
      await base44.entities.WhatsAppTemplate.create(data);
    }

    setSaving(false);
    toast({ title: isEdit ? 'Template updated' : 'Template saved' });
    onSaved();
  }

  async function handleSubmitToMeta() {
    if (!form.template_name.trim() || !form.body_text.trim()) {
      toast({ title: 'Error', description: 'Template name and body text are required', variant: 'destructive' });
      return;
    }
    if (examples.some(e => !e.trim())) {
      toast({ title: 'Error', description: 'All example values are required for Meta submission', variant: 'destructive' });
      return;
    }

    // Meta rejects headers with emojis, newlines, asterisks, or formatting characters
    if (form.header_text && /[\n\r*]/.test(form.header_text)) {
      toast({
        title: 'Invalid Header',
        description: 'Header text cannot contain asterisks or new lines. Meta will reject it.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const resp = await base44.functions.invoke('whatsappTemplateManager', {
        action: 'create_template',
        waba_id: '__FROM_ENV__',
        template_name: form.template_name,
        category: form.category,
        language: form.language,
        header_text: form.header_text,
        body_text: form.body_text,
        footer_text: form.footer_text,
        example_values: examples,
      });

      if (resp.data?.success) {
        const saveData = {
          ...form,
          parameter_count: uniqueParams.length,
          parameter_mappings: mappings,
          example_values: examples,
          meta_template_id: resp.data.meta_template_id || '',
          meta_status: 'submitted',
          is_active: true,
        };

        if (isEdit) {
          await base44.entities.WhatsAppTemplate.update(template.id, saveData);
        } else {
          await base44.entities.WhatsAppTemplate.create(saveData);
        }

        toast({ title: 'Submitted to Meta', description: `Template ID: ${resp.data.meta_template_id || 'pending'}` });
        onSaved();
      } else {
        const metaErr = resp.data?.details?.error;
        const errMsg = metaErr?.error_user_msg || metaErr?.message || resp.data?.error || 'Submission failed';
        toast({ title: 'Meta API Error', description: errMsg, variant: 'destructive' });
      }
    } catch (err) {
      const respData = err?.response?.data;
      const metaErr = respData?.details?.error;
      const errMsg = metaErr?.error_user_msg || metaErr?.message || respData?.error || err.message || 'Submission failed';
      toast({ title: 'Meta API Error', description: errMsg, variant: 'destructive' });
    }

    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Template' : 'Create New Template'}</h2>
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Template Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Template Name (Meta) *</label>
            <Input className="h-9 text-sm mt-1 font-mono" value={form.template_name} onChange={e => setField('template_name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="k95_task_overdue" disabled={isEdit && template?.meta_status !== 'draft'} />
            <p className="text-xs text-slate-400 mt-0.5">Lowercase, underscores only. Cannot change after submission.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Display Name</label>
            <Input className="h-9 text-sm mt-1" value={form.display_name} onChange={e => setField('display_name', e.target.value)} placeholder="Task Overdue Notification" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Category *</label>
            <select className="w-full border border-slate-200 rounded-md px-3 h-9 text-sm mt-1 bg-white" value={form.category} onChange={e => setField('category', e.target.value)}>
              <option value="UTILITY">Utility</option>
              <option value="MARKETING">Marketing</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Language</label>
            <select className="w-full border border-slate-200 rounded-md px-3 h-9 text-sm mt-1 bg-white" value={form.language} onChange={e => setField('language', e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Message Content */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Message Content</h3>
        <div>
          <label className="text-xs font-medium text-slate-700">Header Text</label>
            <Input className="h-9 text-sm mt-1" value={form.header_text} onChange={e => setField('header_text', e.target.value)} placeholder="Task Overdue Alert" />
            <p className="text-xs text-slate-400 mt-0.5">No emojis, asterisks, or new lines allowed by Meta.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Body Text * <span className="text-slate-400 font-normal">(Use {'{{1}}'}, {'{{2}}'} etc. for dynamic values)</span></label>
          <textarea
            rows={6}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none font-mono"
            value={form.body_text}
            onChange={e => setField('body_text', e.target.value)}
            placeholder={'Hi {{1}},\n\nYour task {{2}} is overdue.\n📅 Deadline: {{3}}\n\nPlease take action.'}
          />
          <p className="text-xs text-slate-500 mt-1">Detected {uniqueParams.length} parameter(s): {uniqueParams.map(p => `{{${p}}}`).join(', ') || 'none'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Footer Text</label>
          <Input className="h-9 text-sm mt-1" value={form.footer_text} onChange={e => setField('footer_text', e.target.value)} placeholder="K95 ERP Task Management" />
        </div>
      </div>

      {/* Parameter Mapping */}
      {uniqueParams.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Parameter Mapping</h3>
          <p className="text-xs text-slate-500">Map each placeholder to an entity field. When sending, the system resolves values automatically.</p>
          <ParameterMapper
            mappings={mappings}
            examples={examples}
            entities={ENTITIES_WITH_FIELDS}
            triggerEntity={form.trigger_entity}
            onMappingsChange={setMappings}
            onExamplesChange={setExamples}
          />
        </div>
      )}

      {/* Trigger Config */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Trigger Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Source Entity</label>
            <select className="w-full border border-slate-200 rounded-md px-3 h-9 text-sm mt-1 bg-white" value={form.trigger_entity} onChange={e => setField('trigger_entity', e.target.value)}>
              <option value="">— None —</option>
              {ENTITIES_WITH_FIELDS.map(e => <option key={e.name} value={e.name}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Trigger Event</label>
            <select className="w-full border border-slate-200 rounded-md px-3 h-9 text-sm mt-1 bg-white" value={form.trigger_event} onChange={e => setField('trigger_event', e.target.value)}>
              <option value="manual">Manual Send</option>
              <option value="on_create">On Record Create</option>
              <option value="on_update">On Record Update</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Recipient Phone Field</label>
            <Input className="h-9 text-sm mt-1" value={form.recipient_field} onChange={e => setField('recipient_field', e.target.value)} placeholder="e.g. assigned_to_phone" />
            <p className="text-xs text-slate-400 mt-0.5">Entity field path that resolves to a phone number</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <label className="text-xs font-medium text-slate-700">Notes</label>
        <textarea rows={2} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Internal notes about this template…" />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2 pb-6">
        <Button variant="outline" onClick={onBack} className="h-11 sm:h-9 flex-1 sm:flex-none text-sm">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="h-11 sm:h-9 flex-1 sm:flex-none gap-2 text-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save as Draft'}
        </Button>
        <Button onClick={handleSubmitToMeta} disabled={submitting} className="h-11 sm:h-9 flex-1 sm:flex-none gap-2 bg-green-700 hover:bg-green-800 text-sm">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Submitting…' : 'Save & Submit to Meta'}
        </Button>
      </div>
    </div>
  );
}