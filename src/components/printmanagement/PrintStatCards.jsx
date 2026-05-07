import { Printer, Server, AlertTriangle, XCircle } from 'lucide-react';

function Card({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function PrintStatCards({ stats }) {
  const s = stats || {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card icon={Server} label="Active Endpoints" value={s.activeEndpoints ?? 0} color="bg-blue-100 text-blue-700" />
      <Card icon={Printer} label="Active Printers" value={s.activePrinters ?? 0} color="bg-green-100 text-green-700" />
      <Card icon={AlertTriangle} label="Stale Endpoints" value={s.staleEndpoints ?? 0} color="bg-amber-100 text-amber-700" />
      <Card icon={XCircle} label="Failed Jobs (24h)" value={s.failedJobs ?? 0} color="bg-red-100 text-red-700" />
    </div>
  );
}