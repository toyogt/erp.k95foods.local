import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GUIDE_IMAGES = [
  {
    url: 'https://media.base44.com/images/public/69c237f5cfd7eab4cd2d386a/e57d126ab_DoEnglish.png',
    title: 'Do This — Correct Example',
    titleHi: 'ऐसे करो — सही उदाहरण',
    bg: 'bg-green-50',
    border: 'border-green-300',
  },
  {
    url: 'https://media.base44.com/images/public/69c237f5cfd7eab4cd2d386a/fa098f237_DontEnglish.png',
    title: "Don't Do This — Wrong Examples",
    titleHi: 'ऐसे मत करो — गलत उदाहरण',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
  {
    url: 'https://media.base44.com/images/public/69c237f5cfd7eab4cd2d386a/3845d1c7d_DoHindi.png',
    title: 'ऐसे करो — सही उदाहरण',
    titleHi: 'ऐसे करो — सही उदाहरण',
    bg: 'bg-green-50',
    border: 'border-green-300',
  },
  {
    url: 'https://media.base44.com/images/public/69c237f5cfd7eab4cd2d386a/e1347ca56_DontHindi.png',
    title: 'ऐसे मत करो — गलत उदाहरण',
    titleHi: 'ऐसे मत करो — गलत उदाहरण',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
];

export function InfoButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-200 transition-colors animate-pulse hover:animate-none"
      title="Photo Guide — Do's & Don'ts"
    >
      <Info className="w-4 h-4" />
      <span className="hidden sm:inline">Photo Guide</span>
    </button>
  );
}

export default function GateEntryInfoModal({ onClose }) {
  const [current, setCurrent] = useState(0);
  const img = GUIDE_IMAGES[current];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl border-2 ${img.border} w-full max-w-sm overflow-hidden`}>
        {/* Header */}
        <div className={`${img.bg} px-4 py-3 flex items-center justify-between`}>
          <p className="font-bold text-slate-800 text-sm">{img.title}</p>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Image */}
        <div className="relative">
          <img
            src={img.url}
            alt={img.title}
            className="w-full object-contain max-h-[60vh]"
          />
        </div>

        {/* Navigation */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1"
            disabled={current === 0}
            onClick={() => setCurrent(c => c - 1)}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>

          <div className="flex gap-1.5">
            {GUIDE_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i === current ? 'bg-slate-700' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          {current < GUIDE_IMAGES.length - 1 ? (
            <Button size="sm" className="h-9 gap-1" onClick={() => setCurrent(c => c + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="sm" className="h-9" onClick={onClose}>
              Done ✓
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}