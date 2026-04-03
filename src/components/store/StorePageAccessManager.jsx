import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, X, CheckCircle2, Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const STORE_PAGES = [
  { key: 'SMSDashboard', label: 'Store Dashboard' },
  { key: 'GateEntry', label: 'Gate Entry' },
  { key: 'GRNReceive', label: 'Goods Receipt' },
  { key: 'SMSLotManager', label: 'Lot Manager' },
  { key: 'SMSPutaway', label: 'Putaway' },
  { key: 'SMSStockOut', label: 'Stock Issue' },
  { key: 'SMSTransfer', label: 'Internal Transfer' },
  { key: 'SMSOpeningStock', label: 'Opening Stock' },
  { key: 'SMSReorderConfig', label: 'Reorder Alerts' },
  { key: 'SMSCycleCount', label: 'Cycle Count' },
  { key: 'SMSAdjustments', label: 'Adjustments' },
  { key: 'SMSLocationManager', label: 'Locations' },
  { key: 'SMSReports', label: 'Store Reports' },
  { key: 'QCInbox', label: 'Quality Control Inbox' },
];

export default function StorePageAccessManager({ onClose }) {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPages, setUserPages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.User.list('-created_date', 200),
      base44.entities.AppRole.filter({ is_active: true }),
    ]).then(([u, r]) => {
      setUsers(u);
      setRoles(r);
      setLoading(false);
    });
  }, []);

  function selectUser(user) {
    setSelectedUser(user);
    // Load user's store page access from their custom data
    const pages = user.store_page_access || [];
    setUserPages(pages);
  }

  function togglePage(pageKey) {
    setUserPages(prev =>
      prev.includes(pageKey) ? prev.filter(p => p !== pageKey) : [...prev, pageKey]
    );
  }

  function selectAll() { setUserPages(STORE_PAGES.map(p => p.key)); }
  function deselectAll() { setUserPages([]); }

  async function handleSave() {
    if (!selectedUser) return;
    setSaving(true);
    await base44.entities.User.update(selectedUser.id, { store_page_access: userPages });
    toast({ title: 'Access updated', description: `${selectedUser.full_name || selectedUser.email} now has ${userPages.length} page(s)` });
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, store_page_access: userPages } : u));
    setSaving(false);
  }

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5" /> Store Page Access</h2>
            <p className="text-xs text-slate-500 mt-0.5">Assign which store pages each user can see</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* User list */}
          <div className="w-64 border-r border-slate-200 flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input className="pl-8 h-8 text-xs" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-8">Loading...</p>
              ) : filteredUsers.map(u => (
                <button key={u.id} onClick={() => selectUser(u)} className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${selectedUser?.id === u.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                  <p className="text-sm font-medium text-slate-800 truncate">{u.full_name || u.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{u.role || 'user'}</span>
                    {u.store_page_access?.length > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{u.store_page_access.length} pages</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Page assignment */}
          <div className="flex-1 flex flex-col">
            {!selectedUser ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a user to manage access</div>
            ) : (
              <>
                <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-xs text-slate-500">Role: {selectedUser.role || 'user'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select All</button>
                    <button onClick={deselectAll} className="text-xs text-red-500 hover:underline">Clear All</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STORE_PAGES.map(page => {
                      const checked = userPages.includes(page.key);
                      return (
                        <label key={page.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border transition-all ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <input type="checkbox" checked={checked} onChange={() => togglePage(page.key)} className="w-4 h-4 rounded" />
                          <span className={`text-sm font-medium ${checked ? 'text-blue-800' : 'text-slate-700'}`}>{page.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="px-5 py-3 border-t flex justify-end">
                  <Button className="gap-2" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Access'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}