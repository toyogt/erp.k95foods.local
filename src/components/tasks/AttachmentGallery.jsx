import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Paperclip, X } from 'lucide-react';

/**
 * AttachmentGallery — shows task attachments as thumbnails with lightbox preview.
 * Props:
 *   attachments: Array<{ url, name, type }>
 */
export default function AttachmentGallery({ attachments = [] }) {
  const [preview, setPreview] = useState(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-medium text-slate-500">
          {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {attachments.map((att, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setPreview(att)}
            className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-blue-400 transition-all shrink-0"
          >
            {att.type === 'video' ? (
              <video src={att.url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={att.url} alt={att.name || 'Attachment'} className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {preview && (
        <Dialog open onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-2xl p-2">
            <button
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            {preview.type === 'video' ? (
              <video src={preview.url} controls autoPlay className="w-full max-h-[80vh] rounded-lg" />
            ) : (
              <img src={preview.url} alt={preview.name || 'Attachment'} className="w-full max-h-[80vh] object-contain rounded-lg" />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}