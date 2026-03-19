import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Camera, Video, AlignLeft, Hash, CheckSquare, Loader2, Upload } from 'lucide-react';

export default function StepChecklistRunner({ step, onComplete, onCancel }) {
  const checklist = step.step_checklist || [];
  const [responses, setResponses] = useState(() => {
    const init = {};
    checklist.forEach(item => { init[item.id] = item.type === 'checkbox' ? false : ''; });
    return init;
  });
  const [uploading, setUploading] = useState({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (id, val) => setResponses(r => ({ ...r, [id]: val }));

  const handleFileUpload = async (item, file) => {
    setUploading(u => ({ ...u, [item.id]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set(item.id, file_url);
    setUploading(u => ({ ...u, [item.id]: false }));
  };

  const isValid = checklist.every(item => {
    if (!item.required) return true;
    const val = responses[item.id];
    if (item.type === 'checkbox') return val === true;
    return val && String(val).trim() !== '';
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    await onComplete({ note, checklist_responses: responses });
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800 text-base">{step.step_name}</h3>
        <p className="text-sm text-slate-500 mt-0.5">Complete all required items to mark this step done.</p>
      </div>

      {checklist.length === 0 ? (
        <p className="text-sm text-slate-400">No checklist items for this step.</p>
      ) : (
        <div className="space-y-3">
          {checklist.map((item) => (
            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-start gap-2 mb-1">
                <ItemIcon type={item.type} />
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  {item.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                  {item.hint && <p className="text-xs text-slate-400 mt-0.5">{item.hint}</p>}
                </div>
              </div>

              {item.type === 'checkbox' && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!responses[item.id]}
                    onChange={e => set(item.id, e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm text-slate-600">
                    {responses[item.id] ? 'Done ✓' : 'Mark as done'}
                  </span>
                </label>
              )}

              {item.type === 'text' && (
                <Textarea
                  value={responses[item.id]}
                  onChange={e => set(item.id, e.target.value)}
                  placeholder="Enter your response…"
                  className="mt-2 h-20 text-sm"
                />
              )}

              {item.type === 'number' && (
                <Input
                  type="number"
                  value={responses[item.id]}
                  onChange={e => set(item.id, e.target.value)}
                  placeholder="Enter value…"
                  className="mt-2 h-10"
                />
              )}

              {(item.type === 'photo' || item.type === 'video') && (
                <div className="mt-2">
                  {responses[item.id] ? (
                    <div className="space-y-2">
                      {item.type === 'photo' ? (
                        <img src={responses[item.id]} alt="uploaded" className="h-32 w-auto rounded-lg border border-slate-200 object-cover" />
                      ) : (
                        <video src={responses[item.id]} controls className="h-32 w-auto rounded-lg border border-slate-200" />
                      )}
                      <button
                        type="button"
                        onClick={() => set(item.id, '')}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove & re-upload
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-lg p-3 hover:bg-slate-100 transition">
                      {uploading[item.id] ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      ) : (
                        <Upload className="w-5 h-5 text-slate-400" />
                      )}
                      <span className="text-sm text-slate-500">
                        {uploading[item.id] ? 'Uploading…' : `Tap to upload ${item.type}`}
                      </span>
                      <input
                        type="file"
                        accept={item.type === 'photo' ? 'image/*' : 'video/*'}
                        capture={item.type === 'photo' ? 'environment' : undefined}
                        className="hidden"
                        onChange={e => e.target.files[0] && handleFileUpload(item, e.target.files[0])}
                        disabled={uploading[item.id]}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completion Note */}
      <div>
        <label className="text-xs font-medium text-slate-600">Completion Note (optional)</label>
        <Input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Any notes about completing this step…"
          className="mt-1"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1 min-h-[44px]">Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting || Object.values(uploading).some(Boolean)}
          className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Submit & Mark Done
        </Button>
      </div>
    </div>
  );
}

function ItemIcon({ type }) {
  const icons = { checkbox: CheckSquare, text: AlignLeft, number: Hash, photo: Camera, video: Video };
  const Icon = icons[type] || CheckSquare;
  return <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />;
}