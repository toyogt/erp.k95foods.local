import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Printer, ArrowLeft, Eye, Send, Loader2 } from 'lucide-react';

export default function PrintJobCreate() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const [form, setForm] = useState({
    source_type: 'path',
    source_value: '',
    label_size: '4x6',
    template_id: '',
    copies: 1,
    preferred_workstation_id: '',
    group: '',
  });
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);

  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations-active'],
    queryFn: () => base44.entities.Workstation.filter({ is_active: true }),
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.source_value.trim()) return 'Source value is required';
    if (!form.label_size && !form.template_id) return 'Either Label Size or Template ID is required';
    const c = parseInt(form.copies, 10);
    if (!c || c < 1 || c > 200) return 'Copies must be between 1 and 200';
    return null;
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) return toast({ title: 'Invalid input', description: err, variant: 'destructive' });
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await base44.functions.invoke('printRouteJob', { ...form, copies: parseInt(form.copies, 10) });
      setPreview(res.data);
    } catch (e) {
      toast({ title: 'Route preview failed', description: e.message, variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) return toast({ title: 'Invalid input', description: err, variant: 'destructive' });
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('printSubmitJob', { ...form, copies: parseInt(form.copies, 10) });
      const data = res.data;
      if (data?.ok) {
        toast({ title: 'Print job submitted', description: `ERP Job ${data.erp_job_id} → ${data.selected?.printer}` });
        nav(`/PrintJobs?erp_job_id=${data.erp_job_id}`);
      } else {
        toast({ title: 'Submission failed', description: data?.error?.message || data?.error || 'Unknown error', variant: 'destructive' });
        setPreview(data);
      }
    } catch (e) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center"><Printer className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">New Print Job</h1>
          <p className="text-xs text-slate-500">ERP routes and submits to the best workstation print agent</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">Source Type</Label>
            <Select value={form.source_type} onValueChange={v => update('source_type', v)}>
              <SelectTrigger className="h-11 md:h-9 text-base md:text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="path">File path</SelectItem>
                <SelectItem value="url">URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Copies</Label>
            <Input type="number" min={1} max={200} className="h-11 md:h-9 text-base md:text-sm" value={form.copies} onChange={e => update('copies', e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">Source Value</Label>
          <Input className="h-11 md:h-9 text-base md:text-sm font-mono" placeholder={form.source_type === 'url' ? 'https://...' : '/path/to/label.pdf'} value={form.source_value} onChange={e => update('source_value', e.target.value)} />
          <p className="text-xs text-slate-500 mt-1">{form.source_type === 'url' ? 'Public URL the print agent can fetch' : 'Path accessible to the print agent'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">Label Size</Label>
            <Input className="h-11 md:h-9 text-base md:text-sm" placeholder="e.g. 4x6" value={form.label_size} onChange={e => update('label_size', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Template Id (optional)</Label>
            <Input className="h-11 md:h-9 text-base md:text-sm" value={form.template_id} onChange={e => update('template_id', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">Preferred Workstation (optional)</Label>
            <Select value={form.preferred_workstation_id || '__none__'} onValueChange={v => update('preferred_workstation_id', v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-11 md:h-9 text-base md:text-sm"><SelectValue placeholder="Auto-route" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Auto-route</SelectItem>
                {workstations.map(w => <SelectItem key={w.workstation_id} value={w.workstation_id}>{w.display_name} ({w.workstation_id})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Group (optional)</Label>
            <Input className="h-11 md:h-9 text-base md:text-sm" placeholder="e.g. carton, bottle" value={form.group} onChange={e => update('group', e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" className="h-11 md:h-9 gap-2 text-sm" onClick={handlePreview} disabled={previewing}>
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview Route
          </Button>
          <Button className="h-11 md:h-9 gap-2 text-sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Print
          </Button>
        </div>
      </div>

      {preview && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Routing Preview</h3>
          {preview.chosen ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-green-800">Chosen: {preview.chosen.printer_name}</div>
              <div className="text-xs text-green-700 mt-0.5">Workstation {preview.chosen.workstation_id} · agent {preview.chosen.agent_id} · tier {preview.chosen.tier}</div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">No candidate printer matched routing criteria.</div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Routing trace</summary>
            <pre className="mt-2 bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto text-[11px] font-mono">{JSON.stringify(preview.routing_trace || preview, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}