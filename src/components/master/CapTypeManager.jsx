import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Upload, FileText, X, ExternalLink, Users } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';

export default function CapTypeManager({ user }) {
  const [caps, setCaps] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [capTypes, setCapTypes] = useState([]);
  const [capColours, setCapColours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [selectedCap, setSelectedCap] = useState(null);
  const [form, setForm] = useState({
    cap_type: '',
    cap_colour: '',
    cap_photo_url: '',
    cap_nickname: '',
    datasheet_urls: []
  });
  const [vendorForm, setVendorForm] = useState({
    vendor_name: '',
    vendor_part_number: '',
    lead_time_days: '',
    moq: '',
    unit_price: '',
    is_preferred: false,
    notes: ''
  });
  const [newCapType, setNewCapType] = useState('');
  const [newCapColour, setNewCapColour] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [capData, vendorData, typeData, colourData] = await Promise.all([
      base44.entities.CapType.list(),
      base44.entities.CapVendor.list(),
      base44.entities.CapTypeMaster.filter({ is_active: true }, 'sort_order').catch(() => []),
      base44.entities.CapColourMaster.filter({ is_active: true }, 'sort_order').catch(() => [])
    ]);
    setCaps(capData);
    setVendors(vendorData);
    setCapTypes(typeData);
    setCapColours(colourData);
    setLoading(false);
  }

  function generateCapDetails(capType, colour) {
    const typeShort = capType.replace(' Cap', '').replace(' ', '').toUpperCase();
    const colourShort = colour.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const sku = `CAP-${typeShort}-${colourShort}-${timestamp}`;
    const name = `${capType} - ${colour}`;
    return { sku, name };
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, cap_photo_url: file_url }));
    } catch (err) {
      alert('Photo upload failed: ' + err.message);
    }
    setUploading(false);
  }

  async function handleDatasheetUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, datasheet_urls: [...(f.datasheet_urls || []), file_url] }));
    } catch (err) {
      alert('Datasheet upload failed: ' + err.message);
    }
    setUploading(false);
  }

  function removeDatasheet(url) {
    setForm(f => ({ ...f, datasheet_urls: f.datasheet_urls.filter(u => u !== url) }));
  }

  async function handleSave() {
    if (!form.cap_type || !form.cap_colour?.trim() || !form.cap_photo_url) {
      alert('Cap Type, Cap Colour, and Cap Photo are mandatory.');
      return;
    }

    setSaving(true);
    const { sku, name } = generateCapDetails(form.cap_type, form.cap_colour);
    const payload = {
      cap_sku_code: selectedCap?.cap_sku_code || sku,
      cap_name: name,
      cap_type: form.cap_type,
      cap_colour: form.cap_colour,
      cap_photo_url: form.cap_photo_url,
      cap_nickname: form.cap_nickname || '',
      datasheet_urls: form.datasheet_urls || [],
      is_active: true
    };

    try {
      if (selectedCap) {
        await base44.entities.CapType.update(selectedCap.id, payload);
        await logAudit({ action: 'Update Cap Type', entity_type: 'CapType', entity_id: selectedCap.cap_sku_code, user, details: { cap_sku: selectedCap.cap_sku_code } });
      } else {
        await base44.entities.CapType.create(payload);
        await logAudit({ action: 'Create Cap Type', entity_type: 'CapType', entity_id: sku, user, details: { cap_sku: sku } });
      }
      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  }

  async function handleDelete(cap) {
    if (!confirm(`Delete cap "${cap.cap_name}"?`)) return;
    await base44.entities.CapType.delete(cap.id);
    await logAudit({ action: 'Delete Cap Type', entity_type: 'CapType', entity_id: cap.cap_sku_code, user, details: { cap_sku: cap.cap_sku_code } });
    await loadData();
  }

  function openNew() {
    setSelectedCap(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(cap) {
    setSelectedCap(cap);
    setForm({
      cap_type: cap.cap_type,
      cap_colour: cap.cap_colour,
      cap_photo_url: cap.cap_photo_url,
      cap_nickname: cap.cap_nickname || '',
      datasheet_urls: cap.datasheet_urls || []
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setForm({ cap_type: '', cap_colour: '', cap_photo_url: '', cap_nickname: '', datasheet_urls: [] });
  }

  async function addNewCapType() {
    if (!newCapType.trim()) return;
    await base44.entities.CapTypeMaster.create({ cap_type_name: newCapType.trim(), is_active: true });
    setNewCapType('');
    await loadData();
  }

  async function addNewCapColour() {
    if (!newCapColour.trim()) return;
    await base44.entities.CapColourMaster.create({ colour_name: newCapColour.trim(), is_active: true });
    setNewCapColour('');
    await loadData();
  }

  const previewDetails = form.cap_type && form.cap_colour ? generateCapDetails(form.cap_type, form.cap_colour) : null;

  function openVendorDialog(cap) {
    setSelectedCap(cap);
    setVendorForm({ vendor_name: '', vendor_part_number: '', lead_time_days: '', moq: '', unit_price: '', is_preferred: false, notes: '' });
    setVendorDialogOpen(true);
  }

  async function handleSaveVendor() {
    if (!vendorForm.vendor_name?.trim()) {
      alert('Vendor name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      cap_sku_code: selectedCap.cap_sku_code,
      vendor_name: vendorForm.vendor_name,
      vendor_part_number: vendorForm.vendor_part_number || '',
      lead_time_days: vendorForm.lead_time_days ? Number(vendorForm.lead_time_days) : undefined,
      moq: vendorForm.moq ? Number(vendorForm.moq) : undefined,
      unit_price: vendorForm.unit_price ? Number(vendorForm.unit_price) : undefined,
      is_preferred: vendorForm.is_preferred,
      notes: vendorForm.notes || ''
    };
    try {
      await base44.entities.CapVendor.create(payload);
      await logAudit({ action: 'Add Cap Vendor', entity_type: 'CapVendor', entity_id: selectedCap.cap_sku_code, user, details: { vendor: vendorForm.vendor_name } });
      setVendorDialogOpen(false);
      await loadData();
    } catch (err) {
      alert('Save vendor failed: ' + err.message);
    }
    setSaving(false);
  }

  async function handleDeleteVendor(vendorId) {
    if (!confirm('Delete this vendor?')) return;
    await base44.entities.CapVendor.delete(vendorId);
    await loadData();
  }

  const capVendorsMap = vendors.reduce((acc, v) => {
    if (!acc[v.cap_sku_code]) acc[v.cap_sku_code] = [];
    acc[v.cap_sku_code].push(v);
    return acc;
  }, {});

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cap Types</h2>
          <p className="text-xs text-slate-500">Manage cap specifications and vendors</p>
        </div>
        <Button onClick={openNew} className="gap-2 h-11 px-4">
          <Plus className="w-4 h-4" /> New Cap Type
        </Button>
      </div>

      {caps.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-400 text-sm">No cap types yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {caps.map(cap => {
            const capVendors = capVendorsMap[cap.cap_sku_code] || [];
            return (
              <div key={cap.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="aspect-video bg-slate-100 relative">
                  {cap.cap_photo_url ? (
                    <img src={cap.cap_photo_url} alt={cap.cap_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-300 text-xs">No photo</div>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="font-mono text-xs text-slate-400">{cap.cap_sku_code}</p>
                    <p className="font-semibold text-slate-900 text-sm mt-0.5">{cap.cap_name}</p>
                    {cap.cap_nickname && <p className="text-xs text-slate-500 mt-0.5">"{cap.cap_nickname}"</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-medium">{cap.cap_type}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium">{cap.cap_colour}</span>
                    {capVendors.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-medium flex items-center gap-1">
                        <Users className="w-3 h-3" />{capVendors.length}
                      </span>
                    )}
                  </div>
                  {cap.datasheet_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cap.datasheet_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <FileText className="w-3 h-3" />Doc {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => openEdit(cap)}>
                      <Pencil className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => openVendorDialog(cap)}>
                      <Users className="w-3 h-3 mr-1" />Vendors
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => handleDelete(cap)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cap Type Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCap ? 'Edit Cap Type' : 'New Cap Type'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Cap Type *</Label>
                <select value={form.cap_type} onChange={e => setForm(f => ({ ...f, cap_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-11">
                  <option value="">Select cap type...</option>
                  {capTypes.map(ct => <option key={ct.id} value={ct.cap_type_name}>{ct.cap_type_name}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                  <Input value={newCapType} onChange={e => setNewCapType(e.target.value)} placeholder="Add new cap type" className="h-9 text-xs flex-1" />
                  <Button size="sm" variant="outline" onClick={addNewCapType} disabled={!newCapType.trim()} className="h-9 px-3 text-xs shrink-0">
                    <Plus className="w-3 h-3 mr-1" />Add
                  </Button>
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Cap Colour *</Label>
                <select value={form.cap_colour} onChange={e => setForm(f => ({ ...f, cap_colour: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-11">
                  <option value="">Select colour...</option>
                  {capColours.map(cc => <option key={cc.id} value={cc.colour_name}>{cc.colour_name}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                  <Input value={newCapColour} onChange={e => setNewCapColour(e.target.value)} placeholder="Add new colour" className="h-9 text-xs flex-1" />
                  <Button size="sm" variant="outline" onClick={addNewCapColour} disabled={!newCapColour.trim()} className="h-9 px-3 text-xs shrink-0">
                    <Plus className="w-3 h-3 mr-1" />Add
                  </Button>
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Cap Nickname</Label>
                <Input value={form.cap_nickname} onChange={e => setForm(f => ({ ...f, cap_nickname: e.target.value }))} placeholder="Internal reference name" className="h-11" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Cap Photo *</Label>
                {form.cap_photo_url ? (
                  <div className="space-y-2">
                    <img src={form.cap_photo_url} alt="Cap" className="w-full h-40 object-cover rounded-lg border" />
                    <Button size="sm" variant="outline" className="w-full h-9" onClick={() => setForm(f => ({ ...f, cap_photo_url: '' }))}>
                      <X className="w-3.5 h-3.5 mr-1" />Remove Photo
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <div className="text-center"><Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Click to upload photo</p></div>}
                  </label>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Datasheets (optional)</Label>
                {form.datasheet_urls?.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {form.datasheet_urls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">
                          Document {idx + 1}
                        </a>
                        <button onClick={() => removeDatasheet(url)} className="text-red-600 hover:text-red-700 shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center h-11 border border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleDatasheetUpload} className="hidden" disabled={uploading} />
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <span className="text-xs text-slate-600 flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Upload Datasheet</span>}
                </label>
              </div>
            </div>

            {/* Preview Section */}
            {previewDetails && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-xs font-bold text-blue-900">Auto-Generated Preview</p>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-blue-700 font-medium">SKU Code:</span>
                    <span className="font-mono text-sm text-blue-900 font-bold">{previewDetails.sku}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-blue-700 font-medium">SKU Name:</span>
                    <span className="text-sm text-blue-900 font-semibold">{previewDetails.name}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || !form.cap_type || !form.cap_colour?.trim() || !form.cap_photo_url} className="flex-1 h-12">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {selectedCap ? 'Update' : 'Create'} Cap Type
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-12">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor Management Dialog */}
      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendors for {selectedCap?.cap_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Add Vendor Form */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-700">Add New Vendor</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Vendor Name *</Label>
                  <Input value={vendorForm.vendor_name} onChange={e => setVendorForm(f => ({ ...f, vendor_name: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vendor Part Number</Label>
                  <Input value={vendorForm.vendor_part_number} onChange={e => setVendorForm(f => ({ ...f, vendor_part_number: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lead Time (days)</Label>
                  <Input type="number" value={vendorForm.lead_time_days} onChange={e => setVendorForm(f => ({ ...f, lead_time_days: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MOQ</Label>
                  <Input type="number" value={vendorForm.moq} onChange={e => setVendorForm(f => ({ ...f, moq: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit Price (₹)</Label>
                  <Input type="number" step="0.01" value={vendorForm.unit_price} onChange={e => setVendorForm(f => ({ ...f, unit_price: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Input value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <input type="checkbox" checked={vendorForm.is_preferred} onChange={e => setVendorForm(f => ({ ...f, is_preferred: e.target.checked }))} className="w-4 h-4" />
                  <Label className="text-xs">Preferred Vendor</Label>
                </div>
              </div>
              <Button onClick={handleSaveVendor} disabled={saving || !vendorForm.vendor_name?.trim()} className="w-full h-9">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Add Vendor
              </Button>
            </div>

            {/* Existing Vendors List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Current Vendors ({capVendorsMap[selectedCap?.cap_sku_code]?.length || 0})</p>
              {capVendorsMap[selectedCap?.cap_sku_code]?.length > 0 ? (
                capVendorsMap[selectedCap.cap_sku_code].map(v => (
                  <div key={v.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{v.vendor_name}</p>
                        {v.vendor_part_number && <p className="text-xs text-slate-500 font-mono mt-0.5">Part# {v.vendor_part_number}</p>}
                      </div>
                      <div className="flex gap-1">
                        {v.is_preferred && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">Preferred</span>}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => handleDeleteVendor(v.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                      {v.lead_time_days && <span>⏱️ {v.lead_time_days} days</span>}
                      {v.moq && <span>📦 MOQ: {v.moq}</span>}
                      {v.unit_price && <span>💰 ₹{v.unit_price}</span>}
                    </div>
                    {v.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{v.notes}</p>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">No vendors added yet</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}