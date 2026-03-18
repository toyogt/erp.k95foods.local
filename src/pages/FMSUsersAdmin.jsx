import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, User, Shield, Users } from 'lucide-react';

const FMS_ROLES = ['admin', 'pc', 'designer', 'user'];

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  pc: 'bg-purple-100 text-purple-700 border-purple-200',
  designer: 'bg-blue-100 text-blue-700 border-blue-200',
  user: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ROLE_LABELS = {
  admin: 'Admin — full access',
  pc: 'Process Controller — monitor & escalate',
  designer: 'Designer — create/edit templates',
  user: 'User — view & complete own tasks',
};

export default function FMSUsersAdmin() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);

  const load = async () => {
    const [u, cu] = await Promise.all([
      base44.entities.User.list(),
      base44.auth.me(),
    ]);
    setUsers(u);
    setCurrentUser(cu);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) return (
    <div className="p-8 text-center text-slate-500">
      <Shield className="w-10 h-10 mx-auto mb-2 text-slate-300" />
      <p>User administration is only available to admins.</p>
    </div>
  );

  const handleRoleChange = async (userId, newRole) => {
    setSaving(userId);
    try {
      await base44.entities.User.update(userId, { role: newRole });
      setUsers(u => u.map(user => user.id === userId ? { ...user, role: newRole } : user));
    } finally {
      setSaving(null);
    }
  };

  const filtered = users.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users & Roles</h1>
          <p className="text-sm text-slate-500">{users.length} users total</p>
        </div>
      </div>

      {/* Role legend */}
      <Card className="p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role Guide</p>
        {FMS_ROLES.map(r => (
          <div key={r} className="flex items-center gap-2">
            <Badge className={`${ROLE_COLORS[r]} border text-xs w-20 justify-center`}>{r}</Badge>
            <span className="text-xs text-slate-600">{ROLE_LABELS[r]}</span>
          </div>
        ))}
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className="pl-9" />
      </div>

      {/* Users */}
      <div className="space-y-2">
        {filtered.map(u => (
          <Card key={u.id} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{u.full_name || '—'}</p>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
              </div>
              <div className="shrink-0">
                {u.id === currentUser?.id ? (
                  <Badge className={`${ROLE_COLORS[u.role] || ROLE_COLORS.user} border text-xs`}>{u.role || 'user'} (you)</Badge>
                ) : (
                  <Select value={u.role || 'user'} onValueChange={v => handleRoleChange(u.id, v)}
                    disabled={saving === u.id}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FMS_ROLES.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}