/**
 * Vehicle Arrival Marking Step — shown on Delivery Note Detail when status is waiting_for_transporter.
 * Captures vehicle number and marks arrival time.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Truck, Loader2, CheckCircle2 } from 'lucide-react';

export default function VehicleArrivalStep({ deliveryNote, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicleNo, setVehicleNo] = useState(deliveryNote?.vehicle_number || '');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [saving, setSaving] = useState(false);

  if (deliveryNote?.workflow_state !== 'waiting_for_transporter') return null;

  async function handleMarkArrived() {
    if (!vehicleNo.trim()) {
      toast({ title: 'Vehicle number is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await base44.entities.SalesDeliveryNote.update(deliveryNote.id, {
      vehicle_number: vehicleNo.trim().toUpperCase(),
      workflow_state: 'waiting_for_loading',
      status: 'loading',
      notes: [
        deliveryNote.notes || '',
        `Vehicle ${vehicleNo.trim().toUpperCase()} arrived at ${new Date().toLocaleString('en-IN')}`,
        driverName ? `Driver: ${driverName}` : '',
        driverPhone ? `Driver Phone: ${driverPhone}` : '',
      ].filter(Boolean).join('\n'),
    });

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote',
      entity_id: deliveryNote.id,
      reference_number: deliveryNote.dn_number,
      action: 'vehicle_arrived',
      new_value: `Vehicle: ${vehicleNo}, Driver: ${driverName || 'N/A'}`,
      user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Vehicle Arrived', description: `${vehicleNo.toUpperCase()} — ready for loading` });
    if (onUpdated) onUpdated();
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-blue-600" />
        <h4 className="text-sm font-semibold text-blue-900">Mark Vehicle Arrived</h4>
      </div>
      <p className="text-xs text-blue-700">
        Enter vehicle details when the transporter arrives at the facility.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Vehicle Number *</Label>
          <Input
            className="h-11 md:h-9 text-sm mt-1"
            value={vehicleNo}
            onChange={e => setVehicleNo(e.target.value)}
            placeholder="e.g. HR26AB1234"
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Driver Name</Label>
          <Input
            className="h-11 md:h-9 text-sm mt-1"
            value={driverName}
            onChange={e => setDriverName(e.target.value)}
            placeholder="Driver name (optional)"
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Driver Phone</Label>
          <Input
            className="h-11 md:h-9 text-sm mt-1"
            value={driverPhone}
            onChange={e => setDriverPhone(e.target.value)}
            placeholder="Phone number (optional)"
          />
        </div>
      </div>
      <Button
        className="h-11 bg-blue-700 hover:bg-blue-800 text-white text-sm gap-2"
        onClick={handleMarkArrived}
        disabled={saving}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Mark Vehicle Arrived
      </Button>
    </div>
  );
}