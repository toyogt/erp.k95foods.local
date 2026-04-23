import { MapPin, Package, CalendarClock, Factory, Tag } from 'lucide-react';
import { formatDate } from '@/lib/dateFormatter';

export default function PickingPlanCard({ planItem, index, onQuantityOverride }) {
  const isExpiringSoon = planItem.expiry_date && (() => {
    const exp = new Date(planItem.expiry_date);
    const in30 = new Date(Date.now() + 30 * 86400000);
    return exp <= in30;
  })();

  return (
    <div className={`border rounded-xl p-3 space-y-2 ${isExpiringSoon ? 'border-orange-300 bg-orange-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Pick <span className="text-blue-600">{planItem.pick_quantity} {planItem.uom}</span> from Lot {planItem.lot_id}
            </p>
          </div>
        </div>
        {isExpiringSoon && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 shrink-0">Expiring Soon</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {planItem.batch_number && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>Batch: <strong>{planItem.batch_number}</strong></span>
          </div>
        )}
        {planItem.mfg_date && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Factory className="w-3.5 h-3.5 text-slate-400" />
            <span>Manufacturing: <strong>{formatDate(planItem.mfg_date)}</strong></span>
          </div>
        )}
        {planItem.expiry_date && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <CalendarClock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-orange-500' : 'text-slate-400'}`} />
            <span>Expiry: <strong className={isExpiringSoon ? 'text-orange-700' : ''}>{formatDate(planItem.expiry_date)}</strong></span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>Location: <strong>{planItem.location_code}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          <span>Available: <strong>{planItem.available_at_location} {planItem.uom}</strong></span>
        </div>
        {planItem.supplier_name && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>Supplier: <strong>{planItem.supplier_name}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}