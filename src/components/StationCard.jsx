import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronRight } from 'lucide-react';

export default function StationCard({ icon: Icon, title, subtitle, page, color = 'bg-slate-900', disabled = false }) {
  if (disabled) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 opacity-60 cursor-not-allowed">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-base truncate">{title}</h3>
            <p className="text-sm text-slate-500 truncate">{subtitle}</p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg font-medium">Soon</span>
        </div>
      </div>
    );
  }

  return (
    <Link to={createPageUrl(page)} className="block">
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 active:scale-[0.98] transition-all duration-150 hover:shadow-md hover:border-slate-300">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-base truncate">{title}</h3>
            <p className="text-sm text-slate-500 truncate">{subtitle}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}