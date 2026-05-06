import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Video, X, Loader2, Paperclip } from 'lucide-react';

/**
 * AttachmentUploader — lets user pick or capture photos/videos and uploads them.
 * Props:
 *   attachments: Array<{ url, name, type }>
 *   onChange: (attachments) => void
 */
export default function AttachmentUploader({ attachments = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const uploaded = [];

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push({
        url: file_url,
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : 'image',
      });
    }

    onChange([...attachments, ...uploaded]);
    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAttachment = (index) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9 gap-2 text-sm flex-1"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
          {uploading ? 'Uploading…' : 'Add Photos / Videos'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              {att.type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <Video className="w-6 h-6 text-white" />
                </div>
              ) : (
                <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}