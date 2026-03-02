import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Camera, Loader2 } from 'lucide-react';

const CATEGORY_COLORS = {
  MECHANICAL: 'bg-red-100 text-red-700 border-red-200',
  MATERIAL: 'bg-orange-100 text-orange-700 border-orange-200',
  QUALITY: 'bg-purple-100 text-purple-700 border-purple-200',
  PLANNING: 'bg-blue-100 text-blue-700 border-blue-200',
  CHANGEOVER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  MICRO_STOP: 'bg-slate-100 text-slate-600 border-slate-200',
  OTHER: 'bg-gray-100 text-gray-600 border-gray-200',
};

/**
 * Props:
 *   stationType – "LABELLING" | "CHAMBER" | "FILLING"
 *   durationMinutes – number (computed before showing)
 *   onConfirm(reason_code, notes, photo_url)
 *   onCancel()
 */
export default function DowntimeReasonModal({ stationType, durationMinutes, onConfirm, onCancel }) {
  const [reasons, setReasons] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    base44.entities.DowntimeReason.filter({ station_type: stationType, is_active: true }, 'reason_name', 20)
      .then(setReasons).catch(() => {});
  }, [stationType]);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  }

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(selected, notes, photoUrl);
    setSaving(false);
  }

  const isMicro = durationMinutes !== null && durationMinutes < 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Downtime Reason</h3>
            <p className="text-xs text-slate-500">
              Duration: <b>{durationMinutes != null ? `${durationMinutes.toFixed(1)} min` : '—'}</b>
              {isMicro && <span className="ml-2 bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">Micro-stop</span>}
            </p>
          </div>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Quick reasons */}
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Reason</p>
          {reasons.length === 0 && (
            <p className="text-xs text-slate-400 italic">No reasons configured. Admin can add in Master Data → Downtime.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {reasons.slice(0, 8).map(r => (
              <button
                key={r.reason_code}
                onClick={() => setSelected(r.reason_code)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                  selected === r.reason_code
                    ? 'bg-slate-900 text-white border-slate-900 scale-95'
                    : CATEGORY_COLORS[r.category] || CATEGORY_COLORS.OTHER
                }`}
              >
                {r.reason_name}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Notes (optional)</label>
            <textarea
              className="w-full h-16 px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none resize-none"
              placeholder="What happened?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Photo */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          {photoUrl ? (
            <div className="space-y-1">
              <img src={photoUrl} alt="downtime" className="w-full max-h-28 object-cover rounded-xl border border-slate-200" />
              <button onClick={() => fileRef.current?.click()} className="text-xs text-blue-600 flex items-center gap-1">
                <Camera className="w-3 h-3" /> Retake
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full h-12 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-sm text-slate-400 hover:border-slate-400 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4" /> Add Photo (optional)</>}
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onConfirm(null, notes, photoUrl)}>
            Skip
          </Button>
          <Button className="flex-1 rounded-xl h-11" onClick={handleConfirm} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}