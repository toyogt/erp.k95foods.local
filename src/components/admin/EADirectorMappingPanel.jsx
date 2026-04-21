import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Users, ArrowRight } from 'lucide-react';

export default function EADirectorMappingPanel() {
  const [mappings, setMappings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [eaEmail, setEAEmail] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    const [maps, userList] = await Promise.all([
      base44.entities.EADirectorMapping.list('-created_date', 100),
      base44.entities.User.list(),
    ]);
    setMappings(maps);
    setUsers(userList.filter(u => u.email));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!eaEmail || !directorEmail) return;
    // Check duplicate
    const exists = mappings.find(m => m.ea_email === eaEmail && m.director_email === directorEmail && m.is_active);
    if (exists) return;

    setSaving(true);
    const eaUser = users.find(u => u.email === eaEmail);
    const dirUser = users.find(u => u.email === directorEmail);
    await base44.entities.EADirectorMapping.create({
      ea_email: eaEmail,
      ea_name: eaUser?.full_name || eaEmail,
      director_email: directorEmail,
      director_name: dirUser?.full_name || directorEmail,
      is_active: true,
    });
    setSaving(false);
    setShowAdd(false);
    setEAEmail('');
    setDirectorEmail('');
    load();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await base44.entities.EADirectorMapping.delete(id);
    setDeleting(null);
    load();
  };

  const admins = users.filter(u => u.role === 'admin' || u.role === 'executive_assistant');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">EA — Director Mapping</h3>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5 h-11 md:h-9 px-3">
          <Plus className="w-4 h-4" /> Add Mapping
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : mappings.filter(m => m.is_active).length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="text-slate-400 text-sm">No mappings configured</p>
          <p className="text-slate-300 text-xs mt-1">Add a mapping to let EAs manage tasks for directors</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {mappings.filter(m => m.is_active).map(m => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{m.ea_name || m.ea_email}</p>
                  <p className="text-xs text-slate-400">{m.ea_email}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{m.director_name || m.director_email}</p>
                  <p className="text-xs text-slate-400">{m.director_email}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id)}
                disabled={deleting === m.id} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                {deleting === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add EA — Director Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Executive Assistant</label>
                <Select value={eaEmail} onValueChange={setEAEmail}>
                  <SelectTrigger className="mt-1 h-11 md:h-9"><SelectValue placeholder="Select EA…" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.email} value={u.email}>{u.full_name || u.email} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Director</label>
                <Select value={directorEmail} onValueChange={setDirectorEmail}>
                  <SelectTrigger className="mt-1 h-11 md:h-9"><SelectValue placeholder="Select Director…" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.role === 'admin').map(u => (
                      <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1 h-11">Cancel</Button>
                <Button onClick={handleAdd} disabled={!eaEmail || !directorEmail || saving} className="flex-1 h-11 gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}