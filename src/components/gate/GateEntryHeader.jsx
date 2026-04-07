import { ChevronLeft, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GateEntryHeader({ title, lang, onLangToggle, onHistoryToggle, showHistory }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-blue-600 font-medium"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={onLangToggle}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Toggle language"
        >
          <Languages className="w-4 h-4 text-slate-500" />
        </button>
        <button
          onClick={onHistoryToggle}
          className="text-sm text-blue-600 font-medium"
        >
          {showHistory ? 'New' : 'History'}
        </button>
      </div>
    </div>
  );
}