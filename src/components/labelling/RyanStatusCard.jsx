import { useState, useEffect, useRef } from 'react';
import { callEdge } from '@/components/labelling/edgeClient';
import { AlertTriangle, Activity } from 'lucide-react';

const POLL_MS = 5000;

/**
 * Props: session, wo, isSupervisor
 */
export default function RyanStatusCard({ session, wo, isSupervisor }) {
  const [count, setCount] = useState(null);
  const [rph, setRph] = useState(null); // readings per hour (bottles/hr)
  const [offline, setOffline] = useState(false);
  const [sampleMsg, setSampleMsg] = useState(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const prevRef = useRef(null); // { count, time }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await callEdge('ryan_get_count', { line_machine_id: session.line_machine_id, wo_id: wo.wo_id });
      if (cancelled) return;
      if (res.edge_offline || !res.data) {
        setOffline(true);
        return;
      }
      setOffline(false);
      const newCount = res.data?.count ?? res.data?.value ?? null;
      if (newCount !== null) {
        const now = Date.now();
        if (prevRef.current && prevRef.current.count !== null) {
          const dCount = newCount - prevRef.current.count;
          const dSec = (now - prevRef.current.time) / 1000;
          if (dSec > 0 && dCount >= 0) {
            setRph(Math.round((dCount / dSec) * 3600));
          }
        }
        prevRef.current = { count: newCount, time: now };
        setCount(newCount);
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session.line_machine_id, wo.wo_id]);

  async function printSample(n) {
    setSampleLoading(true);
    setSampleMsg(null);
    const res = await callEdge('ryan_print_sample', { line_machine_id: session.line_machine_id, wo_id: wo.wo_id, n });
    if (res.edge_offline) {
      setSampleMsg({ ok: false, text: 'Edge offline — cannot send print command.' });
    } else if (res.success) {
      setSampleMsg({ ok: true, text: `First-off: printing ${n} labels. Line will pause automatically.` });
    } else {
      setSampleMsg({ ok: false, text: res.data?.message || 'Print command failed.' });
    }
    setSampleLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <p className="font-semibold text-slate-800 text-sm">Ryan Counter</p>
        </div>
        {offline && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> Edge offline
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-slate-900">{count !== null ? count.toLocaleString() : '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">Live Count</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-slate-900">{rph !== null ? rph.toLocaleString() : '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">Bottles / hr</p>
        </div>
      </div>

      {isSupervisor && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">First-off Sample Print</p>
          <div className="flex gap-2">
            <button onClick={() => printSample(10)} disabled={sampleLoading || offline}
              className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors">
              Print 10
            </button>
            <button onClick={() => printSample(20)} disabled={sampleLoading || offline}
              className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 transition-colors">
              Print 20
            </button>
          </div>
          {sampleMsg && (
            <p className={`text-xs font-medium rounded-lg px-3 py-2 ${sampleMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              {sampleMsg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}