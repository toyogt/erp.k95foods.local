import { AlertCircle } from 'lucide-react';

export default function StoresIssue() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <AlertCircle className="w-14 h-14 text-slate-300" />
      <h1 className="text-2xl font-bold text-slate-700">Module Disabled</h1>
      <p className="text-slate-500 max-w-xs">
        Stores Issue is currently disabled. Contact your administrator if you need access.
      </p>
    </div>
  );
}