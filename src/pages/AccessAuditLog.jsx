import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

export default function AccessAuditLog() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.AuditLog.list('-created_date', 200),
    ]).then(([me, logsData]) => {
      setUser(me);
      setLogs(logsData.filter(l => ['permission_change', 'access_grant', 'access_revoke', 'role_assign'].includes(l.action)));
      setLoading(false);
    });
  }, []);

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const actions = [...new Set(logs.map(l => l.action))].sort();
  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchesSearch = !q || l.user_name?.toLowerCase().includes(q) || l.user_email?.toLowerCase().includes(q) || l.entity_type?.toLowerCase().includes(q);
    const matchesAction = actionFilter === 'all' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action) => {
    const styles = {
      'permission_change': 'bg-blue-100 text-blue-700',
      'access_grant': 'bg-green-100 text-green-700',
      'access_revoke': 'bg-red-100 text-red-700',
      'role_assign': 'bg-purple-100 text-purple-700',
    };
    return styles[action] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <FileText className="w-6 h-6 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Access Audit Log</h1>
      </div>
      <p className="text-slate-600">Track all permission and role assignment changes</p>

      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by user, email, or entity type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">User</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Entity</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Details</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No logs found</td></tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{log.user_name}</div>
                      <div className="text-xs text-slate-500">{log.user_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getActionBadge(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{log.entity_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {JSON.stringify(log.details || {}).substring(0, 50)}…
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(log.created_date), 'MMM d, HH:mm')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}