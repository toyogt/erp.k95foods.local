import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, QrCode, Edit2, Search, X, Printer } from 'lucide-react';
import { SkeletonTable } from '@/components/store/StoreSkeleton';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QRCode from 'react-qr-code';

function LocationModal({ loc, onSave, onClose }) {
  const [form, setForm] = useState(loc || { warehouse: '', floor: '', section: '', section_remarks: '', place: '', slab: '', rack: '', capacity_limit: '', location_type: 'storage', is_active: true });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function buildCode(f) {
    const parts = [f.warehouse, f.floor, f.section, f.place, f.slab, f.rack].filter(Boolean);
    return parts.join('-');
  }

  async function handleSave() {
    const code = buildCode(form);
    if (!code) return;
    setSaving(true);
    const payload = { ...form, location_code: code, qr_code: code, display_name: code, capacity_limit: form.capacity_limit ? Number(form.capacity_limit) : null };
    if (loc?.id) await base44.entities.StoreLocation.update(loc.id, payload);
    else await base44.entities.StoreLocation.create(payload);
    toast.success(loc?.id ? 'Location updated!' : 'Location added!');
    onSave();
  }

  const fields = [
    { key: 'warehouse', label: 'Warehouse *', placeholder: 'e.g. WH1' },
    { key: 'floor', label: 'Floor', placeholder: 'e.g. F1' },
    { key: 'section', label: 'Section', placeholder: 'e.g. S2' },
    { key: 'place', label: 'Place', placeholder: 'e.g. P1' },
    { key: 'slab', label: 'Slab', placeholder: 'e.g. SL1' },
    { key: 'rack', label: 'Rack *', placeholder: 'e.g. R4' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">{loc ? 'Edit Location' : 'Add Location'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key}>
                <Label className="text-xs font-medium text-slate-700">{f.label}</Label>
                <Input className="h-9 text-sm mt-1" placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Section Remarks</Label>
            <Input className="h-9 text-sm mt-1" placeholder="Optional notes about this section" value={form.section_remarks || ''} onChange={e => set('section_remarks', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Capacity (Units)</Label>
              <Input type="number" className="h-9 text-sm mt-1" placeholder="Optional" value={form.capacity_limit || ''} onChange={e => set('capacity_limit', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Location Type</Label>
              <select className="w-full h-9 text-sm border border-slate-200 rounded-md px-2 mt-1" value={form.location_type} onChange={e => set('location_type', e.target.value)}>
                <option value="storage">Storage</option>
                <option value="rejected">Rejected</option>
                <option value="quarantine">Quarantine</option>
                <option value="dispatch">Dispatch</option>
              </select>
            </div>
          </div>
          {form.warehouse && form.rack && (
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Location Code (QR)</p>
              <p className="text-sm font-mono font-bold text-slate-800">{buildCode(form)}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !form.warehouse || !form.rack}>
            {saving ? 'Saving...' : 'Save Location'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QRModal({ location, onClose }) {
  function handlePrint() {
    const printWin = window.open('', '_blank', 'width=400,height=500');
    const qrVal = location.qr_code || location.location_code;
    printWin.document.write(`
      <html><head><title>Location QR - ${location.location_code}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:24px} img{width:180px;height:180px} p{margin:4px 0} .mono{font-family:monospace;font-size:13px;font-weight:bold}</style>
      </head><body>
      <p style="font-size:14px;font-weight:600">Location QR Code</p>
      <p style="font-size:12px;color:#666">${location.display_name || location.location_code}</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}" />
      <p class="mono">${location.location_code}</p>
      <p style="font-size:11px;color:#999">${location.location_type || 'storage'}</p>
      </body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  }
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 p-6 w-full max-w-xs text-center">
        <p className="text-sm font-semibold text-slate-700 mb-1">Location QR Code</p>
        <p className="text-xs text-slate-500 mb-4">{location.display_name || location.location_code}</p>
        <div className="flex justify-center mb-4 p-4 bg-white border border-slate-200 rounded-xl">
          <QRCode value={location.qr_code || location.location_code} size={160} />
        </div>
        <p className="text-xs font-mono text-slate-600 mb-4">{location.location_code}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10" onClick={onClose}>Close</Button>
          <Button className="flex-1 h-10 gap-2" onClick={handlePrint}><Printer className="w-4 h-4" /> Print QR</Button>
        </div>
      </div>
    </div>
  );
}

const TYPE_COLORS = { storage: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', quarantine: 'bg-yellow-100 text-yellow-700', dispatch: 'bg-blue-100 text-blue-700' };

export default function SMSLocationManager() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [qrLoc, setQrLoc] = useState(null);

  async function load() {
    setLoading(true);
    const data = await base44.entities.StoreLocation.list('-created_date', 500);
    setLocations(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const warehouses = [...new Set(locations.map(l => l.warehouse).filter(Boolean))];
  const filtered = locations.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.location_code?.toLowerCase().includes(q) || l.warehouse?.toLowerCase().includes(q) || l.section?.toLowerCase().includes(q) || l.rack?.toLowerCase().includes(q);
    const matchWH = !warehouseFilter || l.warehouse === warehouseFilter;
    return matchSearch && matchWH;
  });

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Toaster position="top-right" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Location Manager</h1>
          <p className="text-sm text-slate-500">Warehouse → Floor → Section → Place → Slab → Rack</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton data={filtered} columns={[
            { key: 'location_code', label: 'Code' }, { key: 'warehouse', label: 'Warehouse' },
            { key: 'floor', label: 'Floor' }, { key: 'section', label: 'Section' },
            { key: 'place', label: 'Place' }, { key: 'slab', label: 'Slab' }, { key: 'rack', label: 'Rack' },
            { key: 'location_type', label: 'Type' }, { key: 'capacity_limit', label: 'Capacity' },
          ]} filename="locations" />
          <Button onClick={() => { setEditLoc(null); setShowModal(true); }} className="gap-2 h-11">
            <Plus className="w-4 h-4" /> Add Location
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-11 md:h-9 text-base md:text-sm" placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-11 md:h-9 border border-slate-200 rounded-md px-3 text-base md:text-sm" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
          <option value="">All Warehouses</option>
          {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={7} headers={['Location Code','Warehouse','Floor / Section','Place / Slab / Rack','Type','Capacity','Actions']} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No locations found. Add your first location.</div>
      ) : (
      <>
      {/* Desktop Table */}
      <div className="hidden md:block bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="text-left px-4 py-3 font-semibold">Location Code</th>
                <th className="text-left px-4 py-3 font-semibold">Warehouse</th>
                <th className="text-left px-4 py-3 font-semibold">Floor / Section</th>
                <th className="text-left px-4 py-3 font-semibold">Place / Slab / Rack</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Capacity</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(loc => (
                <tr key={loc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{loc.location_code}</td>
                  <td className="px-4 py-3 text-slate-700">{loc.warehouse}</td>
                  <td className="px-4 py-3 text-slate-600">{[loc.floor, loc.section].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{[loc.place, loc.slab, loc.rack].filter(Boolean).join(' / ') || loc.rack}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[loc.location_type] || 'bg-slate-100 text-slate-600'}`}>{loc.location_type || 'storage'}</span></td>
                  <td className="px-4 py-3 text-slate-600">{loc.capacity_limit ? `${loc.capacity_limit} units` : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQrLoc(loc)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800" title="View QR Code"><QrCode className="w-4 h-4" /></button>
                      <button onClick={() => { setEditLoc(loc); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800" title="Edit"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">{filtered.length} location(s)</div>
      </div>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {filtered.map(loc => (
          <div key={loc.id} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold text-slate-800">{loc.location_code}</p>
                <p className="text-xs text-slate-500 mt-0.5">{loc.warehouse}{loc.floor ? ` · ${loc.floor}` : ''}{loc.section ? ` · ${loc.section}` : ''}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${TYPE_COLORS[loc.location_type] || 'bg-slate-100 text-slate-600'}`}>{loc.location_type || 'storage'}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              {loc.rack && <span>Rack: <strong className="text-slate-700">{loc.rack}</strong></span>}
              {loc.capacity_limit && <span>Capacity: <strong className="text-slate-700">{loc.capacity_limit}</strong></span>}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setQrLoc(loc)} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"><QrCode className="w-4 h-4" /> QR Code</button>
              <button onClick={() => { setEditLoc(loc); setShowModal(true); }} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"><Edit2 className="w-4 h-4" /> Edit</button>
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-400 text-center py-1">{filtered.length} location(s)</p>
      </div>
      </>
      )}

      {showModal && <LocationModal loc={editLoc} onSave={() => { setShowModal(false); load(); }} onClose={() => setShowModal(false)} />}
      {qrLoc && <QRModal location={qrLoc} onClose={() => setQrLoc(null)} />}
    </motion.div>
  );
}