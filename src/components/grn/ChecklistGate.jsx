/**
 * Renders a simple inline checklist (Google-Forms-style) from a ChecklistTemplate.
 * Items support: checkbox, text, number, photo types.
 * onComplete(runId) is called when all required items are filled and user taps submit.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Camera, Loader2 } from 'lucide-react';

export default function ChecklistGate({ template, entityId, entityType, user, onComplete, onSkip }) {
  const items = JSON.parse(template.items_json || '[]');
  const [responses, setResponses] = useState({});
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function setVal(idx, val) {
    setResponses(prev => ({ ...prev, [idx]: val }));
  }

  async function uploadPhoto(idx, file) {
    setUploading(prev => ({ ...prev, [idx]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setVal(idx, file_url);
    setUploading(prev => ({ ...prev, [idx]: false }));
  }

  function validate() {
    return items.every((it, idx) => {
      if (!it.required) return true;
      const val = responses[idx];
      if (it.type === 'checkbox') return val === true;
      return val !== undefined && val !== '' && val !== null;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    const run_id = `CR-${Date.now()}`;
    const responsesArr = items.map((it, idx) => ({ label: it.label, type: it.type, value: responses[idx] ?? '' }));
    await base44.entities.ChecklistRun.create({
      run_id,
      template_id: template.template_id || template.id,
      entity_type: entityType,
      entity_id: entityId,
      responses_json: JSON.stringify(responsesArr),
      completed_by: user?.email || '',
      completed_at: new Date().toISOString(),
      status: 'COMPLETED',
    });
    onComplete(run_id);
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
        <p className="text-sm font-bold text-blue-800">{template.template_name || template.name}</p>
        <p className="text-xs text-blue-600">{template.description || 'Complete all required items before proceeding.'}</p>
      </div>

      {items.map((it, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-slate-200 p-3 space-y-1">
          <label className="text-sm font-semibold text-slate-700">
            {it.label}{it.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {it.type === 'checkbox' && (
            <button type="button" onClick={() => setVal(idx, !responses[idx])}
              className={`flex items-center gap-2 mt-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all w-full ${responses[idx] ? 'bg-green-50 border-green-400 text-green-700' : 'border-slate-200 text-slate-500'}`}>
              <CheckCircle2 className={`w-4 h-4 ${responses[idx] ? 'text-green-500' : 'text-slate-300'}`} />
              {responses[idx] ? 'Confirmed ✓' : 'Tap to confirm'}
            </button>
          )}

          {it.type === 'text' && (
            <input type="text" value={responses[idx] || ''} onChange={e => setVal(idx, e.target.value)}
              placeholder={it.placeholder || 'Enter text…'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          )}

          {it.type === 'number' && (
            <input type="number" value={responses[idx] || ''} onChange={e => setVal(idx, e.target.value)}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          )}

          {it.type === 'photo' && (
            <div>
              {responses[idx] ? (
                <img src={responses[idx]} alt="" className="w-28 h-20 object-cover rounded-xl border border-slate-200" />
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all w-40">
                  {uploading[idx] ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Camera className="w-4 h-4 text-slate-400" />}
                  <span className="text-xs text-slate-400">{uploading[idx] ? 'Uploading…' : 'Take / Upload'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => e.target.files?.[0] && uploadPhoto(idx, e.target.files[0])} />
                </label>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={!validate() || submitting} className="flex-1 bg-green-600 hover:bg-green-700 h-11">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Submit Checklist
        </Button>
        {onSkip && (
          <Button variant="outline" onClick={onSkip} className="h-11">Skip</Button>
        )}
      </div>
    </div>
  );
}