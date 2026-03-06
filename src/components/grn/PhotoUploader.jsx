import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Loader2, CheckCircle2, X } from 'lucide-react';

export default function PhotoUploader({ label, required, value, onChange }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="w-32 h-24 object-cover rounded-xl border border-slate-200" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 shadow"
          >
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-32 h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
          {uploading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <Camera className="w-6 h-6 text-slate-400" />}
          <span className="text-xs text-slate-400 mt-1">{uploading ? 'Uploading…' : 'Tap to upload'}</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
    </div>
  );
}