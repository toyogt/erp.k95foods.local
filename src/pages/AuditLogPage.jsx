import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Search, Filter, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import moment from 'moment';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    setLoading(true);
    const data = await base44.entities.AuditLog.list('-created_date', 100);
    setLogs(data);
    setLoading(false);
  }

  const filtered = logs.filter(log => {
    const matchSearch = !search || 
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(search.toLowerCase());
    const matchEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    return matchSearch && matchEntity;
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">{filtered.length} entries</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadLogs} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search actions, IDs, users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-11"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[140px] rounded-xl h-11">
            <Filter className="w-4 h-4 mr-1 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {entityTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400">No audit entries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div key={log.id} className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {log.entity_type && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        {log.entity_type}
                      </span>
                    )}
                    {log.entity_id && (
                      <span className="text-xs text-slate-500 font-mono">{log.entity_id}</span>
                    )}
                  </div>
                </div>
                {!log.synced && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium flex-shrink-0">
                    Offline
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                <span>{log.user_name || log.user_email || 'System'}</span>
                <span>·</span>
                <span>{moment(log.created_date).format('DD MMM HH:mm:ss')}</span>
                {log.station && (
                  <>
                    <span>·</span>
                    <span>{log.station}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}