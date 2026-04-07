import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvoicePreviewModal({ imageUrl, title, onClose }) {
  if (!imageUrl) return null;

  const isPdf = imageUrl.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">{title || 'Invoice Preview'}</h3>
          <div className="flex items-center gap-2">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isPdf ? (
            <iframe src={imageUrl} className="w-full h-[70vh] rounded-lg border border-slate-200" title="Invoice" />
          ) : (
            <img src={imageUrl} alt="Invoice" className="w-full rounded-lg border border-slate-200 object-contain max-h-[70vh]" />
          )}
        </div>
      </div>
    </div>
  );
}