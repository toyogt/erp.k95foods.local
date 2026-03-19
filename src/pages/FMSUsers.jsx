import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Loader2, UserPlus, Mail, Shield } from 'lucide-react';
import { isAdmin } from '@/lib/fmsHelpers';

const FMS_ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Full access' },
  { value: 'process_designer', label: 'Process Designer', desc: 'Create & edit processes' },
  { value: 'process_controller', label: 'Process Controller (PC)', desc: 'Monitor & intervene' },
  { value: 'user', label: 'User (Task Doer)', desc: 'See & complete own tasks' },
];

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  process_designer: 'bg-blue-100 text-blue-700',
  process_controller: 'bg-orange-100 text-orange-700',
  user: 'bg-slate-100 text-slate-600',
};

export default function FMSUsers() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [savingRole, setSavingRole] = useState(null);

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);
    if (!isAdmin(me)) { setLoading(false); return; }
    const userList = await base44.entities.User.list();
    setUsers(userList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteError('');
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setInviteRole('user');
      setShowInvite(false);
      load();
    } catch (e) {
      setInviteError(e?.message || 'Failed to invite user');
    }
    setInviting(false);
  };

  const updateRole = async (u, newRole) => {
    setSavingRole(u.id);
    await base44.entities.User.update(u.id, { role: newRole });
    setSavingRole(null);
    load();
  };

  if (!isAdmin(user) && !loading) {
    return (
      <FMSLayout user={user}>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Admin access required.</p>
        </div>
      </FMSLayout>
    );
  }

  return (
    <FMSLayout user={user}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-500 text-sm mt-1">Manage users and their roles</p>
          </div>
          <Button onClick={() => setShowInvite(true)} className="gap-2 min-h-[44px]">
            <UserPlus className="w-4 h-4" /> Invite User
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Role summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {FMS_ROLES.map(r => {
                const count = users.filter(u => u.role === r.value).length;
                return (
                  <div key={r.value} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                    <p className="text-xl font-bold text-slate-700">{count}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{r.label}</p>
                  </div>
                );
              })}
            </div>

            {/* User table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1fr] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-slate-100">
                {users.map(u => (
                  <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.5fr_1fr] gap-2 sm:gap-4 px-5 py-4 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm font-bold shrink-0">
                        {(u.full_name || u.email)[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-700 text-sm">{u.full_name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-500'}`}>
                        {FMS_ROLES.find(r => r.value === u.role)?.label || u.role || 'user'}
                      </span>
                    </div>
                    <div>
                      {savingRole === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : u.id !== user?.id ? (
                        <Select value={u.role || 'user'} onValueChange={v => updateRole(u, v)}>
                          <SelectTrigger className="h-8 text-xs w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FMS_ROLES.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-slate-400">(you)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invite dialog */}
      {showInvite && (
        <Dialog open onOpenChange={() => { setShowInvite(false); setInviteError(''); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FMS_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label} — {r.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="text-red-600 text-sm">{inviteError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button onClick={invite} disabled={inviting || !inviteEmail} className="min-h-[44px]">
                  {inviting ? 'Inviting…' : 'Send Invite'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </FMSLayout>
  );
}