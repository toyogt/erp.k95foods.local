import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

function genId() { return 'MFG-' + Date.now().toString(36).toUpperCase(); }

export default function ManufacturerManager() {
  const [manufacturers, setManufacturers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ manufacturer_name: '', addresses: [{ address_line_1: '', address_line_2: '', fssai_no: '' }] });

  const loadAll = async () => {
    const data = await base44.entities.ManufacturerMaster.filter({ is_active: true });
    setManufacturers(data);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async () => {
    if (!form.manufacturer_name?.trim()) {
      alert('Manufacturer name is required');
      return;
    }
    const payload = {
      manufacturer_id: form.manufacturer_id || genId(),
      manufacturer_name: form.manufacturer_name,
      addresses: form.addresses.filter(a => a.address_line_1 || a.address_line_2 || a.fssai_no),
      is_active: true,
    };
    if (editing) {
      await base44.entities.ManufacturerMaster.update(editing.id, payload);
      toast.success('Updated');
    } else {
      await base44.entities.ManufacturerMaster.create(payload);
      toast.success('Created');
    }
    setForm({ manufacturer_name: '', addresses: [{ address_line_1: '', address_line_2: '', fssai_no: '' }] });
    setEditing(null);
    loadAll();
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({ ...item, addresses: item.addresses?.length > 0 ? item.addresses : [{ address_line_1: '', address_line_2: '', fssai_no: '' }] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this manufacturer?')) return;
    await base44.entities.ManufacturerMaster.delete(id);
    toast.success('Deleted');
    loadAll();
  };

  const addAddress = () => {
    setForm(f => ({ ...f, addresses: [...f.addresses, { address_line_1: '', address_line_2: '', fssai_no: '' }] }));
  };

  const removeAddress = (idx) => {
    setForm(f => ({ ...f, addresses: f.addresses.filter((_, i) => i !== idx) }));
  };

  const updateAddress = (idx, key, value) => {
    setForm(f => ({
      ...f,
      addresses: f.addresses.map((a, i) => i === idx ? { ...a, [key]: value } : a)
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <p className="text-sm font-bold text-slate-700">{editing ? 'Edit Manufacturer' : 'Add Manufacturer'}</p>
        <Input
          value={form.manufacturer_name}
          onChange={e => setForm(f => ({ ...f, manufacturer_name: e.target.value }))}
          placeholder="Manufacturer Name"
          className="h-11"
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600">Addresses & FSSAI</p>
            <Button size="sm" variant="outline" onClick={addAddress} className="h-8">
              <Plus className="w-4 h-4 mr-1" />Add Address
            </Button>
          </div>
          {form.addresses.map((addr, idx) => (
            <Card key={idx} className="p-3 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">Address {idx + 1}</p>
                {form.addresses.length > 1 && (
                  <button onClick={() => removeAddress(idx)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Input
                value={addr.address_line_1}
                onChange={e => updateAddress(idx, 'address_line_1', e.target.value)}
                placeholder="Address Line 1"
                className="h-10 text-sm"
              />
              <Input
                value={addr.address_line_2}
                onChange={e => updateAddress(idx, 'address_line_2', e.target.value)}
                placeholder="Address Line 2"
                className="h-10 text-sm"
              />
              <Input
                value={addr.fssai_no}
                onChange={e => updateAddress(idx, 'fssai_no', e.target.value)}
                placeholder="FSSAI No"
                className="h-10 text-sm"
              />
            </Card>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} className="h-10 gap-2">
            <Save className="w-4 h-4" />{editing ? 'Update' : 'Add'}
          </Button>
          {editing && (
            <Button variant="outline" onClick={() => { setEditing(null); setForm({ manufacturer_name: '', addresses: [{ address_line_1: '', address_line_2: '', fssai_no: '' }] }); }} className="h-10 gap-2">
              <X className="w-4 h-4" />Cancel
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        {manufacturers.map(item => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{item.manufacturer_name}</p>
                {item.addresses?.map((addr, idx) => (
                  <div key={idx} className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-2">
                    <p className="font-medium text-xs text-slate-500">Address {idx + 1}</p>
                    {addr.address_line_1 && <p>{addr.address_line_1}</p>}
                    {addr.address_line_2 && <p>{addr.address_line_2}</p>}
                    {addr.fssai_no && <p className="text-xs font-mono bg-slate-200 inline-block px-2 py-0.5 rounded mt-1">FSSAI: {addr.fssai_no}</p>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 ml-3">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-9">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-9">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {manufacturers.length === 0 && <p className="text-center text-slate-400 py-8">No manufacturers yet</p>}
      </div>
    </div>
  );
}