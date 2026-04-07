import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, FileText, Package, Loader2, X, CheckCircle2 } from 'lucide-react';

const ICON_MAP = {
  vehicle: Camera,
  invoice: FileText,
  material: Package,
};

export default function PhotoCaptureCard({ type, label, helpText, value, onChange, large = false }) {
  const [uploading, setUploading] = useState(false);
  const Icon = ICON_MAP[type] || Camera;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  }

  if (value) {
    return (
      <div className={`relative rounded-2xl overflow-hidden border border-slate-200 ${large ? 'aspect-[4/3]' : 'aspect-[3/2]'}`}>
        <img src={value} alt={label} className="w-full h-full object-cover" />
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
          <button
            onClick={() => onChange('')}
            className="bg-white/90 backdrop-blur border border-slate-200 rounded-full p-1 shadow-sm"
          >
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
          <p className="text-white text-xs font-medium">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <label className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 cursor-pointer
      hover:border-blue-400 hover:bg-blue-50/50 transition-all bg-slate-50/50
      ${large ? 'aspect-[4/3] py-8' : 'aspect-[3/2] py-6'}`}
    >
      {uploading ? (
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-2">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{uploading ? 'Uploading...' : 'Tap to take or upload'}</p>
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}