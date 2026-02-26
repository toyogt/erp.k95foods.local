import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Camera, CheckCircle, Loader2 } from 'lucide-react';

export default function HandoverStep({ pallet, user, onComplete }) {
  const [palletPhoto, setPalletPhoto] = useState(null);   // { file, previewUrl }
  const [manifestPhoto, setManifestPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const timestampRef = useRef(new Date());

  const palletInputRef = useRef(null);
  const manifestInputRef = useRef(null);

  function captureHandler(setter) {
    return (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setter({ file, previewUrl: URL.createObjectURL(file) });
    };
  }

  async function handleSubmit() {
    setSaving(true);
    let palletUrl = null;
    let manifestUrl = null;

    if (palletPhoto?.file) {
      const res = await base44.integrations.Core.UploadFile({ file: palletPhoto.file });
      palletUrl = res.file_url;
    }
    if (manifestPhoto?.file) {
      const res = await base44.integrations.Core.UploadFile({ file: manifestPhoto.file });
      manifestUrl = res.file_url;
    }

    await base44.entities.BoxPallet.update(pallet.id, {
      status: 'HANDED_OVER',
      handover_at: timestampRef.current.toISOString(),
      handover_from_user: user?.email || '',
      handover_photo_pallet: palletUrl,
      handover_photo_manifest: manifestUrl,
    });

    setSaving(false);
    setDone(true);
    setTimeout(() => onComplete?.(), 1500);
  }

  if (done) return (
    <div className="flex flex-col items-center gap-4 text-center py-12">
      <CheckCircle className="w-16 h-16 text-emerald-500" />
      <h3 className="font-bold text-slate-900 text-xl">Handover Complete!</h3>
      <p className="font-mono text-slate-600">{pallet.pallet_id}</p>
      <p className="text-xs text-slate-400">{timestampRef.current.toLocaleString()}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Info bar */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pallet</span>
          <p className="font-bold text-slate-900 font-mono text-lg">{pallet.pallet_id}</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Timestamp</span>
          <p className="text-sm font-semibold text-slate-700">{timestampRef.current.toLocaleString()}</p>
        </div>
      </div>

      {/* Photo 1: Full pallet */}
      <PhotoCapture
        inputRef={palletInputRef}
        title="Photo 1 — Pallet with Boxes"
        description="Photograph the sealed pallet showing all boxes"
        photo={palletPhoto}
        onCapture={captureHandler(setPalletPhoto)}
        onRetake={() => setPalletPhoto(null)}
      />

      {/* Photo 2: Manifest on pallet */}
      <PhotoCapture
        inputRef={manifestInputRef}
        title="Photo 2 — Manifest on Pallet"
        description="Place the manifest paper on the pallet and photograph"
        photo={manifestPhoto}
        onCapture={captureHandler(setManifestPhoto)}
        onRetake={() => setManifestPhoto(null)}
      />

      <Button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold text-base gap-2"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading Photos…</> : <><CheckCircle className="w-4 h-4" /> Complete Handover</>}
      </Button>
    </div>
  );
}

function PhotoCapture({ inputRef, title, description, photo, onCapture, onRetake }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {photo && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
      </div>

      {photo ? (
        <div className="relative">
          <img src={photo.previewUrl} alt={title} className="w-full rounded-xl object-cover max-h-56" />
          <button
            onClick={onRetake}
            className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 text-xs font-semibold text-slate-700 shadow border border-slate-200"
          >
            Retake
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors active:bg-slate-50"
        >
          <Camera className="w-7 h-7" />
          <span className="text-xs font-semibold">Tap to Open Camera</span>
        </button>
      )}

      {/* camera only — no file picker */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCapture}
        onClick={e => { e.target.value = ''; }}
      />
    </div>
  );
}