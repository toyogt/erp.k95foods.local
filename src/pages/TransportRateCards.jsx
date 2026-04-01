import TransportRateManager from '@/components/sales/logistics/TransportRateManager';
import { Truck } from 'lucide-react';

export default function TransportRateCards() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Transport Rate Cards</h1>
          <p className="text-sm text-slate-500">Manage weight-based transportation rate cards for logistics cost estimation</p>
        </div>
      </div>
      <TransportRateManager />
    </div>
  );
}