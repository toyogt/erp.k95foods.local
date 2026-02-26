import { Warehouse } from 'lucide-react';

export default function WarehouseOps() {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-900">Warehouse Ops</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center gap-3 text-center">
        <Warehouse className="w-10 h-10 text-sky-600" />
        <p className="font-semibold text-slate-700">Coming in next prompt</p>
        <p className="text-sm text-slate-400">Receive pallets, run QC inspections, dispatch stock.</p>
      </div>
    </div>
  );
}