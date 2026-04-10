import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ScrollText } from 'lucide-react';
import moment from 'moment';

export default function LblEventLogPage() {
  const [search, setSearch] = useState('');
  const { data: events = [], isLoading } = useQuery({ queryKey: ['lbl-event-log'], queryFn: () => base44.entities.LblEventLog.list('-created_date', 200) });

  const filtered = search ? events.filter(e => e.description?.toLowerCase().includes(search.toLowerCase()) || e.action_type?.toLowerCase().includes(search.toLowerCase()) || e.performed_by_name?.toLowerCase().includes(search.toLowerCase())) : events;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div><h1 className="text-xl md:text-2xl font-bold text-slate-900">Labelling Event Log</h1><p className="text-sm text-slate-500">History of all labelling department actions</p></div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 md:h-9" /></div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-lg"><ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-slate-500">No events found</p></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {filtered.map(e => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-900">{e.action_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span><span className="text-xs text-slate-400">{moment(e.timestamp || e.created_date).format('DD/MM/YYYY HH:mm')}</span></div>
              {e.description && <p className="text-sm text-slate-600 mt-0.5">{e.description}</p>}
              {e.performed_by_name && <p className="text-xs text-slate-400 mt-0.5">By: {e.performed_by_name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}