import { useState } from 'react';
import { CheckCircle2, Camera, Video, AlignLeft, Hash, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';

function ItemIcon({ type }) {
  const icons = { checkbox: CheckSquare, text: AlignLeft, number: Hash, photo: Camera, video: Video };
  const Icon = icons[type] || CheckSquare;
  return <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />;
}

export default function ChecklistReview({ checklist, responses }) {
  const [open, setOpen] = useState(false);
  if (!checklist || checklist.length === 0) return null;
  const answered = checklist.filter(item => {
    const val = responses?.[item.id];
    return val !== undefined && val !== '' && val !== false;
  }).length;

  return (
    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-medium text-slate-600">
            Checklist Review — {answered}/{checklist.length} answered
          </span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {checklist.map(item => {
            const val = responses?.[item.id];
            const isPhoto = item.type === 'photo';
            const isVideo = item.type === 'video';
            const isCheckbox = item.type === 'checkbox';
            const hasValue = val !== undefined && val !== '' && val !== false;

            return (
              <div key={item.id} className="px-3 py-2.5 bg-white">
                <div className="flex items-start gap-2">
                  <ItemIcon type={item.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-600">{item.label}</p>
                    {hasValue ? (
                      isPhoto ? (
                        <a href={val} target="_blank" rel="noopener noreferrer">
                          <img src={val} alt="response" className="mt-1.5 h-24 w-auto rounded-lg border border-slate-200 object-cover" />
                        </a>
                      ) : isVideo ? (
                        <video src={val} controls className="mt-1.5 h-24 w-auto rounded-lg border border-slate-200" />
                      ) : isCheckbox ? (
                        <p className="text-xs text-green-600 mt-0.5">✓ Confirmed</p>
                      ) : (
                        <p className="text-xs text-slate-700 mt-0.5 break-words">{String(val)}</p>
                      )
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5 italic">Not answered</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}