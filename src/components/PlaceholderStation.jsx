import { Construction } from 'lucide-react';

export default function PlaceholderStation({ title }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500 max-w-sm">
        This station is under development. Full functionality will be available in a future release.
      </p>
    </div>
  );
}