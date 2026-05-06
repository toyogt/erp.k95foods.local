import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, MessageSquare } from 'lucide-react';

export default function ProgressHistoryPanel({ taskId }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) { setLoading(false); return; }
    base44.entities.DirectorTaskLog.filter({ task_id: taskId, action: 'edited' }, '-timestamp', 50)
      .then(logs => {
        // Extract progress updates from log details
        const progressLogs = logs
          .filter(l => l.details?.startsWith('Progress update:'))
          .map(l => ({
            id: l.id,
            note: l.details.replace('Progress update: ', ''),
            by: l.performed_by_name || 'Unknown',
            at: l.timestamp,
          }));
        setUpdates(progressLogs);
      })
      .catch(() => setUpdates([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (updates.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Progress Updates
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {updates.map((u, idx) => (
          <div key={u.id} className={`${idx === 0 ? 'bg-blue-100/60' : 'bg-white/60'} rounded-lg px-3 py-2`}>
            <p className="text-sm text-blue-900 whitespace-pre-wrap">{u.note}</p>
            <p className="text-xs text-blue-400 mt-1">
              {new Date(u.at).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
              })}
              {u.by && <span> — {u.by}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}