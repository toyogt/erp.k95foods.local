import { useState } from 'react';
import TransportRateManager from '@/components/sales/logistics/TransportRateManager';
import RateCardCSVImport from '@/components/sales/logistics/RateCardCSVImport';
import { Truck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TransportRateCards() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Transport Rate Cards</h1>
            <p className="text-sm text-slate-500">Manage weight-based transport rates mapped to customers and customer groups</p>
          </div>
        </div>
        <Button variant="outline" className="h-11 text-sm gap-2" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4" /> Import from CSV
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-sm text-amber-800">
          <strong>Rate Matching Logic:</strong> When generating logistics cost estimates, the system matches rates in this order — 
          <strong> Customer Name → Customer Group → Default (no customer/group)</strong>.
          Leave customer and group blank to create a default fallback rate.
        </p>
      </div>

      <TransportRateManager />

      <RateCardCSVImport open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}