import { Upload } from 'lucide-react';

export default function OpeningStockImport() {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-900">Opening Stock Import</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center gap-3 text-center">
        <Upload className="w-10 h-10 text-slate-500" />
        <p className="font-semibold text-slate-700">Coming in next prompt</p>
        <p className="text-sm text-slate-400">Import legacy opening stock lots without serialised labels.</p>
      </div>
    </div>
  );
}