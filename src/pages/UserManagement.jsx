import { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Loader2, UserPlus, Mail, Search, Trash2 } from 'lucide-react';
import { auditUserInvited, auditUserRoleChanged } from '@/lib/auditAdminActions';
import EADirectorMappingPanel from '@/components/admin/EADirectorMappingPanel';
import TelegramConfigPanel from '@/components/admin/TelegramConfigPanel';
import WhatsAppPhonePanel from '@/components/admin/WhatsAppPhonePanel';

export default function UserManagement() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [savingRole, setSavingRole] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [me, userList, roleList] = await Promise.all([
      base44.auth.me(),
      base44.entities.User.list(),
      base44.entities.AppRole.filter({ is_active: true }, 'label'),
    ]);
    setUser(me);
    setUsers(userList);
    setRoles(roleList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteError('');
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      await auditUserInvited(user, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setInviteRole('user');
      setShowInvite(false);
      load();
    } catch (e) {
      setInviteError(e?.message || 'Failed to invite user');
    }
    setInviting(false);
  };

  const deleteUser = async (u) => {
    if (!confirm(`Are you sure you want to delete user "${u.full_name || u.email}"? This action cannot be undone.`)) return;
    setDeletingUser(u.id);
    try {
      await base44.entities.User.delete(u.id);
      load();
    } catch (e) {
      console.error('Error deleting user:', e);
      alert(e?.message || 'Failed to delete user');
    }
    setDeletingUser(null);
  };

  const updateRole = async (u, newRole) => {
    setSavingRole(u.id);
    try {
      await base44.entities.User.update(u.id, { role: newRole });
      await auditUserRoleChanged(user, u.email, u.role, newRole);
      load();
    } catch (e) {
      console.error('Error updating role:', e);
    }
    setSavingRole(null);
  };

  // Access control handled by Layout.jsx — if user isn't admin, they won't reach this page

  const getRoleRecord = (roleKey) => roles.find(r => r.role_key === roleKey);

  const getColorCls = (color) => {
    const MAP = {
      slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700', green: 'bg-green-100 text-green-700',
      orange: 'bg-orange-100 text-orange-700', red: 'bg-red-100 text-red-700',
      pink: 'bg-pink-100 text-pink-700', teal: 'bg-teal-100 text-teal-700',
      indigo: 'bg-indigo-100 text-indigo-700', yellow: 'bg-yellow-100 text-yellow-700',
    };
    return MAP[color] || MAP.slate;
  };

  // Role summary counts
  const roleCounts = roles.reduce((acc, r) => {
    acc[r.role_key] = users.filter(u => u.role === r.role_key).length;
    return acc;
  }, {});

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Manage users and assign roles</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-2 h-11 px-4">
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Role summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {roles.slice(0, 8).map(r => (
              <div key={r.role_key} className="bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-xl font-bold text-slate-700">{roleCounts[r.role_key] || 0}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{r.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search by name, email or role…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* User list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1.5fr_auto] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Name</span><span>Email</span><span>Current Role</span><span>Change Role</span><span></span>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">No users found</div>
              )}
              {filtered.map(u => {
                const roleRecord = getRoleRecord(u.role);
                return (
                  <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.5fr_1.5fr_auto] gap-2 sm:gap-4 px-5 py-4 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm font-bold shrink-0">
                        {(u.full_name || u.email)[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-700 text-sm">{u.full_name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getColorCls(roleRecord?.color)}`}>
                        {roleRecord?.label || u.role || 'user'}
                      </span>
                    </div>
                    <div>
                      {savingRole === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : u.id === user?.id ? (
                        <span className="text-xs text-slate-400">(you)</span>
                      ) : (
                        <Select value={u.role || 'user'} onValueChange={v => updateRole(u, v)}>
                          <SelectTrigger className="h-9 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(r => (
                              <SelectItem key={r.role_key} value={r.role_key}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={deletingUser === u.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[40px]"
                          title="Delete user"
                        >
                          {deletingUser === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* EA-Director Mapping */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <EADirectorMappingPanel />
        </div>
      )}

      {/* WhatsApp Phone Numbers */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <WhatsAppPhonePanel users={users} onReload={load} />
        </div>
      )}

      {/* Telegram Configuration */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <TelegramConfigPanel users={users} onReload={load} />
        </div>
      )}

      {/* Invite dialog */}
      {showInvite && (
        <Dialog open onOpenChange={() => { setShowInvite(false); setInviteError(''); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Email Address <span className="text-red-500">*</span></Label>
                <Input type="email" value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="user@company.com" className="mt-1" />
              </div>
              <div>
                <Label>Role <span className="text-red-500">*</span></Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User — Standard access</SelectItem>
                    <SelectItem value="admin">Admin — Full system access</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">Module-specific roles can be assigned from the Roles page after the user joins</p>
              </div>
              {inviteError && <p className="text-red-600 text-sm">{inviteError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button onClick={invite} disabled={inviting || !inviteEmail} className="h-11 px-4">
                  {inviting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Inviting…</> : 'Send Invite'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}