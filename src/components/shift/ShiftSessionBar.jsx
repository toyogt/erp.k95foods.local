import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, UserCheck, Loader2, ArrowRightLeft } from 'lucide-react';
import ShiftStartModal from './ShiftStartModal';
import ShiftHandoverModal from './ShiftHandoverModal';

/**
 * Displays the active shift session for a station + machine.
 * Shows "Start Shift" if none active, and "Handover" button if active.
 *
 * Props:
 *   stationType – "FILLING" | "LABELLING" | "CHAMBER"
 *   machineId
 *   user
 *   onSessionActive(session) – called when a session becomes active
 */
export default function ShiftSessionBar({ stationType, machineId, user, onSessionActive }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [showStart, setShowStart] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (machineId) load();
  }, [machineId, stationType]);

  async function load() {
    setLoading(true);
    const sessions = await base44.entities.ShiftSession.filter(
      { station_type: stationType, machine_id: machineId, status: 'ACTIVE' },
      '-started_at',
      1
    ).catch(() => []);
    const s = sessions[0] || null;
    setSession(s);
    if (s) onSessionActive?.(s);
    setLoading(false);
  }

  function handleSessionStarted(s) {
    setSession(s);
    setShowStart(false);
    onSessionActive?.(s);
  }

  function handleHandoverDone(newSession) {
    setSession(newSession);
    setShowHandover(false);
    onSessionActive?.(newSession);
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking shift…
    </div>
  );

  return (
    <>
      {session ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-green-800 truncate">
                Shift: {session.started_by?.split('@')[0]} {session.shift_code ? `· ${session.shift_code}` : ''}
              </p>
              <p className="text-xs text-green-600">
                <Clock className="w-3 h-3 inline mr-0.5" />
                {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowHandover(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-green-300 text-xs font-semibold text-green-700 hover:bg-green-100 shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Handover
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-amber-700">No active shift — tap to start</p>
          <button
            onClick={() => setShowStart(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
          >
            Start Shift
          </button>
        </div>
      )}

      {showStart && (
        <ShiftStartModal
          stationType={stationType}
          machineId={machineId}
          user={user}
          onStarted={handleSessionStarted}
          onCancel={() => setShowStart(false)}
        />
      )}

      {showHandover && session && (
        <ShiftHandoverModal
          stationType={stationType}
          machineId={machineId}
          user={user}
          currentSession={session}
          onDone={handleHandoverDone}
          onCancel={() => setShowHandover(false)}
        />
      )}
    </>
  );
}