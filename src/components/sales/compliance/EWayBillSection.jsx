/**
 * E-Way Bill info + Generate / Cancel / Update Vehicle / Update Transporter / Extend / Fetch Status
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EWayBillStatusBadge } from './ComplianceStatusBadges';
import { Zap, XCircle, Loader2, Truck, RefreshCw, Clock, Edit } from 'lucide-react';

const TRANSPORT_MODES = [
  { value: '1', label: 'Road' },
  { value: '2', label: 'Rail' },
  { value: '3', label: 'Air' },
  { value: '4', label: 'Ship' },
];

export default function EWayBillSection({ invoice, onUpdated }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'generate', 'cancel', 'vehicle', 'transporter', 'extend'
  const [distanceKm, setDistanceKm] = useState(invoice.distance || '');

  // Vehicle update form
  const [vehicleNo, setVehicleNo] = useState('');
  const [fromPlace, setFromPlace] = useState('');
  const [fromState, setFromState] = useState('06');
  const [transportMode, setTransportMode] = useState('1');
  const [reasonCode, setReasonCode] = useState('1');
  const [reasonRemark, setReasonRemark] = useState('');

  // Transporter update form
  const [transporterId, setTransporterId] = useState('');
  const [transporterName, setTransporterName] = useState('');

  // Cancel form
  const [cancelReason, setCancelReason] = useState('');

  // Extend form
  const [remainingDistance, setRemainingDistance] = useState('');

  const ewbStatus = invoice.ewb_status || 'not_generated';
  const hasEWB = !!invoice.eway_bill;
  const hasIRN = !!invoice.irn;

  async function callAPI(action, extra = {}) {
    setLoading(true);
    const resp = await base44.functions.invoke('gstCompliance', {
      action, invoice_id: invoice.id, ...extra,
    });
    setLoading(false);
    return resp.data;
  }

  async function generateEWB() {
    const km = parseInt(distanceKm, 10);
    if (!km || km < 1 || km > 4000) {
      toast({ title: 'Enter a distance between 1 and 4000 km', variant: 'destructive' });
      return;
    }
    const result = await callAPI('generate_ewb', { distance_km: km });
    if (result?.success) {
      toast({ title: 'E-Way Bill generated successfully' });
      setActiveAction(null);
      onUpdated();
    } else {
      toast({ title: 'E-Way Bill generation failed', description: result?.error, variant: 'destructive' });
    }
  }

  async function cancelEWB() {
    if (!cancelReason.trim()) {
      toast({ title: 'Cancellation reason is required', variant: 'destructive' });
      return;
    }
    const result = await callAPI('cancel_ewb', { cancel_reason: cancelReason, cancel_reason_code: '2' });
    if (result?.success) {
      toast({ title: 'E-Way Bill cancelled' });
      setActiveAction(null);
      onUpdated();
    } else {
      toast({ title: 'Cancellation failed', description: result?.error, variant: 'destructive' });
    }
  }

  async function updateVehicle() {
    if (!vehicleNo.trim()) {
      toast({ title: 'Vehicle number is required', variant: 'destructive' });
      return;
    }
    const result = await callAPI('update_vehicle', {
      vehicle_no: vehicleNo, from_place: fromPlace, from_state: fromState,
      transport_mode: transportMode, reason_code: reasonCode, reason_remark: reasonRemark,
    });
    if (result?.success) {
      toast({ title: 'Vehicle info updated successfully' });
      setActiveAction(null);
      onUpdated();
    } else {
      toast({ title: 'Vehicle update failed', description: result?.error, variant: 'destructive' });
    }
  }

  async function updateTransporter() {
    if (!transporterId.trim()) {
      toast({ title: 'Transporter GSTIN is required', variant: 'destructive' });
      return;
    }
    const result = await callAPI('update_transporter', {
      transporter_id: transporterId, transporter_name: transporterName,
    });
    if (result?.success) {
      toast({ title: 'Transporter updated successfully' });
      setActiveAction(null);
      onUpdated();
    } else {
      toast({ title: 'Transporter update failed', description: result?.error, variant: 'destructive' });
    }
  }

  async function extendValidity() {
    const dist = parseInt(remainingDistance, 10);
    if (!dist || dist < 1) {
      toast({ title: 'Enter remaining distance', variant: 'destructive' });
      return;
    }
    const result = await callAPI('extend_validity', {
      remaining_distance: dist, from_place: fromPlace, from_state: fromState,
      transport_mode: transportMode, reason_code: reasonCode || '1',
      reason_remark: reasonRemark || 'Validity extension',
    });
    if (result?.success) {
      toast({ title: `Validity extended. New expiry: ${result.valid_upto}` });
      setActiveAction(null);
      onUpdated();
    } else {
      toast({ title: 'Extension failed', description: result?.error, variant: 'destructive' });
    }
  }

  async function fetchStatus() {
    const result = await callAPI('fetch_ewb_status');
    if (result?.success) {
      toast({ title: `E-Way Bill Status: ${result.ewb_status}`, description: result.valid_upto ? `Valid until: ${result.valid_upto}` : '' });
      onUpdated();
    } else {
      toast({ title: 'Status fetch failed', description: result?.error, variant: 'destructive' });
    }
  }

  function resetAction() {
    setActiveAction(null);
    setVehicleNo(''); setFromPlace(''); setReasonRemark('');
    setTransporterId(''); setTransporterName('');
    setCancelReason(''); setRemainingDistance('');
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Truck className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-slate-900">E-Way Bill</span>
        <span className="ml-auto"><EWayBillStatusBadge status={ewbStatus} /></span>
      </div>

      <div className="p-4 space-y-3">
        {/* EWB Info Display */}
        {hasEWB && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
            <div className="text-sm"><span className="text-slate-500">E-Way Bill Number: </span><span className="font-bold text-slate-900">{invoice.eway_bill}</span></div>
            {invoice.eway_bill_date && <div className="text-sm"><span className="text-slate-500">Generated Date: </span><span className="font-medium">{invoice.eway_bill_date}</span></div>}
            {invoice.eway_valid_upto && <div className="text-sm"><span className="text-slate-500">Valid Until: </span><span className="font-medium text-blue-700">{invoice.eway_valid_upto}</span></div>}
            {invoice.vehicle_no && <div className="text-sm"><span className="text-slate-500">Vehicle: </span><span className="font-medium">{invoice.vehicle_no}</span></div>}
            {invoice.transporter_name && <div className="text-sm"><span className="text-slate-500">Transporter: </span><span className="font-medium">{invoice.transporter_name}</span></div>}
            {invoice.eway_extended_times > 0 && <div className="text-sm"><span className="text-slate-500">Extended: </span><span className="font-medium text-amber-700">{invoice.eway_extended_times} time(s)</span></div>}
          </div>
        )}

        {/* Action Buttons */}
        {!activeAction && (
          <div className="flex gap-2 flex-wrap">
            {!hasEWB && hasIRN && (
              <Button className="h-11 text-sm bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => setActiveAction('generate')} disabled={loading}>
                <Zap className="w-4 h-4 mr-2" /> Generate E-Way Bill
              </Button>
            )}
            {!hasEWB && !hasIRN && (
              <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                IRN is mandatory before generating E-Way Bill. Generate E-Invoice first.
              </div>
            )}
            {hasEWB && ewbStatus === 'generated' && (
              <>
                <Button variant="outline" className="h-11 text-sm" onClick={() => setActiveAction('vehicle')} disabled={loading}>
                  <Edit className="w-4 h-4 mr-1" /> Update Vehicle
                </Button>
                <Button variant="outline" className="h-11 text-sm" onClick={() => setActiveAction('transporter')} disabled={loading}>
                  <Truck className="w-4 h-4 mr-1" /> Update Transporter
                </Button>
                <Button variant="outline" className="h-11 text-sm" onClick={() => setActiveAction('extend')} disabled={loading}>
                  <Clock className="w-4 h-4 mr-1" /> Extend Validity
                </Button>
                <Button variant="outline" className="h-11 text-sm" onClick={fetchStatus} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Fetch Status
                </Button>
                <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setActiveAction('cancel')} disabled={loading}>
                  <XCircle className="w-4 h-4 mr-1" /> Cancel E-Way Bill
                </Button>
              </>
            )}
          </div>
        )}

        {/* Generate EWB Form */}
        {activeAction === 'generate' && (
          <ActionForm title="Generate E-Way Bill" onCancel={resetAction}>
            <div>
              <Label className="text-xs font-medium text-slate-700">Distance (km) *</Label>
              <Input type="number" min={1} max={4000} className="h-9 text-sm mt-1 w-40"
                value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="e.g. 250" />
            </div>
            <Button className="h-11 text-sm bg-blue-700 hover:bg-blue-800 text-white" onClick={generateEWB} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Generate E-Way Bill
            </Button>
          </ActionForm>
        )}

        {/* Update Vehicle Form */}
        {activeAction === 'vehicle' && (
          <ActionForm title="Update Vehicle Information" onCancel={resetAction}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium text-slate-700">Vehicle Number *</Label>
                <Input className="h-9 text-sm mt-1" value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="e.g. HR06AB1234" /></div>
              <div><Label className="text-xs font-medium text-slate-700">From Place</Label>
                <Input className="h-9 text-sm mt-1" value={fromPlace} onChange={e => setFromPlace(e.target.value)} placeholder="City name" /></div>
              <div><Label className="text-xs font-medium text-slate-700">From State Code</Label>
                <Input className="h-9 text-sm mt-1" value={fromState} onChange={e => setFromState(e.target.value)} placeholder="e.g. 06" /></div>
              <div><Label className="text-xs font-medium text-slate-700">Transport Mode</Label>
                <select className="h-9 text-sm mt-1 w-full border rounded-md px-3" value={transportMode} onChange={e => setTransportMode(e.target.value)}>
                  {TRANSPORT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select></div>
              <div className="md:col-span-2"><Label className="text-xs font-medium text-slate-700">Reason</Label>
                <Input className="h-9 text-sm mt-1" value={reasonRemark} onChange={e => setReasonRemark(e.target.value)} placeholder="Reason for vehicle change" /></div>
            </div>
            <Button className="h-11 text-sm bg-slate-900 hover:bg-slate-800 text-white" onClick={updateVehicle} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
              Update Vehicle
            </Button>
          </ActionForm>
        )}

        {/* Update Transporter Form */}
        {activeAction === 'transporter' && (
          <ActionForm title="Update Transporter" onCancel={resetAction}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium text-slate-700">Transporter GSTIN *</Label>
                <Input className="h-9 text-sm mt-1" value={transporterId} onChange={e => setTransporterId(e.target.value)} placeholder="15-digit GSTIN" /></div>
              <div><Label className="text-xs font-medium text-slate-700">Transporter Name</Label>
                <Input className="h-9 text-sm mt-1" value={transporterName} onChange={e => setTransporterName(e.target.value)} placeholder="Transporter name" /></div>
            </div>
            <Button className="h-11 text-sm bg-slate-900 hover:bg-slate-800 text-white" onClick={updateTransporter} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
              Update Transporter
            </Button>
          </ActionForm>
        )}

        {/* Extend Validity Form */}
        {activeAction === 'extend' && (
          <ActionForm title="Extend E-Way Bill Validity" onCancel={resetAction}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium text-slate-700">Remaining Distance (km) *</Label>
                <Input type="number" className="h-9 text-sm mt-1" value={remainingDistance}
                  onChange={e => setRemainingDistance(e.target.value)} placeholder="e.g. 100" /></div>
              <div><Label className="text-xs font-medium text-slate-700">From Place</Label>
                <Input className="h-9 text-sm mt-1" value={fromPlace} onChange={e => setFromPlace(e.target.value)} placeholder="Current location" /></div>
            </div>
            <Button className="h-11 text-sm bg-amber-600 hover:bg-amber-700 text-white" onClick={extendValidity} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
              Extend Validity
            </Button>
          </ActionForm>
        )}

        {/* Cancel EWB Form */}
        {activeAction === 'cancel' && (
          <ActionForm title="Cancel E-Way Bill" onCancel={resetAction} variant="destructive">
            <div><Label className="text-xs font-medium text-red-700">Cancellation Reason *</Label>
              <Input className="h-9 text-sm mt-1 border-red-300" value={cancelReason}
                onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." /></div>
            <Button className="h-11 text-sm bg-red-600 hover:bg-red-700 text-white" onClick={cancelEWB} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirm Cancel
            </Button>
          </ActionForm>
        )}
      </div>
    </div>
  );
}

function ActionForm({ title, children, onCancel, variant }) {
  const bg = variant === 'destructive' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200';
  return (
    <div className={`border rounded-lg p-4 space-y-3 ${bg}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={onCancel}>Close</Button>
      </div>
      {children}
    </div>
  );
}