import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Download } from 'lucide-react';

const QUEUE_KEY = 'factory_offline_queue';

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

export default function SyncQueueViewer() {
  const [queue, setQueue] = useState([]);

  useEffect(() => { reload(); }, []);

  function reload() { setQueue(getQueue()); }

  function clearAll() {
    if (!confirm('Clear all queued items?')) return;
    localStorage.removeItem(QUEUE_KEY);
    setQueue([]);
  }

  function removeItem(id) {
    const q = getQueue().filter(i => i.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    setQueue(q);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline_queue_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500 flex-1">{queue.length} queued item{queue.length !== 1 ? 's' : ''}</p>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-8" onClick={reload}><RefreshCw className="w-3.5 h-3.5" /></Button>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-8" onClick={exportJSON} disabled={queue.length === 0}><Download className="w-3.5 h-3.5" /></Button>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-8 text-red-600 border-red-200" onClick={clearAll} disabled={queue.length === 0}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>

      {queue.length === 0 && (
        <div className="text-center py-10 text-slate-400 text-sm">No pending offline items</div>
      )}

      <div className="space-y-2">
        {queue.map((item, idx) => (
          <div key={item.id || idx} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700">{item.type?.toUpperCase()} {item.entity}</p>
              <p className="text-xs text-slate-500 truncate">{item.auditAction || ''} · {item.auditEntityId || item.data?.crate_id || item.data?.pallet_id || ''}</p>
              <p className="text-xs text-slate-400">{item.queued_at ? new Date(item.queued_at).toLocaleString() : ''}</p>
            </div>
            <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}