import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Loader2, Trash2, ImageIcon } from 'lucide-react';

export default function MaterialPhotoUpload({ value, onChange, required = false }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-700">
        Material Photo {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1">
        {value ? (
          <div className="relative group">
            <img
              src={value}
              alt="Material"
              className="w-full h-32 object-cover rounded-xl border border-slate-200"
            />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Click to upload photo</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
        )}
      </div>
      {required && !value && (
        <p className="text-xs text-red-500 mt-1">Material photo is required</p>
      )}
    </div>
  );
}