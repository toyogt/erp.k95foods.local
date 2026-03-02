import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square, Loader2, AlertCircle, Camera, CheckCircle2 } from 'lucide-react';

function genRunId() { return 'RUN-' + Date.now().toString(36).toUpperCase(); }

/**
 * ChecklistRunner – loads the active template for station_type+stage,
 * renders items dynamically, saves a ChecklistRun on complete.
 *
 * Props:
 *  station_type, stage, reference_type, reference_id, user
 *  onComplete(status, run_id)
 *  onCancel()
 */
export default function ChecklistRunner({ station_type, stage, reference_type, reference_id, user, onComplete, onCancel }) {
  const [template, setTemplate] = useState(null);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTemplate();
  }, [station_type, stage]);

  async function loadTemplate() {
    setLoading(true);
    try {
      const results = await base44.entities.ChecklistTemplate.filter({
        station_type,
        stage,
        is_active: true,
      }, '-version', 1);
      if (results.length === 0) {
        // Fallback: no template configured, auto-pass with a note
        setTemplate(null);
        setError('No active checklist template found for ' + station_type + ' / ' + stage + '. Auto-passing.');
      } else {
        setTemplate(results[0]);
        const initResponses = {};
        (results[0].items_json || []).forEach(item => { initResponses[item.id] = ''; });
        setResponses(initResponses);
      }
    } catch {
      setTemplate(null);
      setError('Could not load template (offline). Auto-passing.');
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!template) { onComplete('COMPLETED', null); return; }
    // Validate required
    const missing = (template.items_json || []).filter(item => item.required && !responses[item.id]);
    if (missing.length > 0) {
      setError('Please complete all required items: ' + missing.map(m => m.label).join(', '));
      return;
    }
    setSaving(true);
    const runId = genRunId();
    const now = new Date().toISOString();
    const runData = {
      run_id: runId,
      template_id: template.template_id,
      version: template.version || 1,
      station_type,
      stage,
      reference_type,
      reference_id,
      responses_json: Object.entries(responses).map(([id, value]) => ({ id, value })),
      completed_by: user?.email || '',
      completed_at: now,
      status: 'COMPLETED',
    };
    try {
      await base44.entities.ChecklistRun.create(runData);
    } catch { /* offline, continue */ }
    setSaving(false);
    onComplete('COMPLETED', runId);
  }

  function setResponse(id, value) {
    setResponses(prev => ({ ...prev, [id]: value }));
    if (error) setError('');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  if (!template) return (
    <div className="space-y-4">
      {error && <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">{error}</p>}
      <Button className="w-full rounded-xl h-12" onClick={() => onComplete('COMPLETED', null)}>Continue</Button>
      {onCancel && <Button variant="outline" className="w-full rounded-xl" onClick={onCancel}>Cancel</Button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{station_type} · {stage}</p>
        <p className="font-bold text-slate-900 text-lg">{template.name}</p>
        <p className="text-xs text-slate-400">v{template.version} · {(template.items_json || []).length} items</p>
      </div>

      <div className="space-y-2">
        {(template.items_json || []).map(item => (
          <ChecklistItem key={item.id} item={item} value={responses[item.id]} onChange={v => setResponse(item.id, v)} />
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>Back</Button>}
        <Button className="flex-1 rounded-xl h-12" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Checklist'}
        </Button>
      </div>
    </div>
  );
}

function ChecklistItem({ item, value, onChange }) {
  if (item.type === 'checkbox') return (
    <button
      onClick={() => onChange(value === 'true' ? '' : 'true')}
      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${value === 'true' ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}
    >
      {value === 'true' ? <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
      <span className={`text-sm font-medium ${value === 'true' ? 'text-emerald-800' : 'text-slate-700'}`}>
        {item.label}{item.required && <span className="text-red-500 ml-1">*</span>}
      </span>
    </button>
  );

  if (item.type === 'number') return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <label className="text-xs text-slate-500 font-medium">{item.label}{item.required && <span className="text-red-500 ml-1">*</span>}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500" />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <label className="text-xs text-slate-500 font-medium">{item.label}{item.required && <span className="text-red-500 ml-1">*</span>}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500" />
    </div>
  );
}