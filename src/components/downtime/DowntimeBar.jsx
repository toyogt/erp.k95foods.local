import { useState } from 'react';
import { PauseCircle, PlayCircle, Clock, AlertCircle } from 'lucide-react';
import DowntimeReasonModal from './DowntimeReasonModal';

/**
 * Compact bar showing downtime state + Pause/Resume buttons.
 * Props:
 *   stationType, machineId, woId
 *   activeEvent – from useDowntime
 *   downtimeMinutesToday – from useDowntime
 *   onPause() – called to start downtime
 *   onResume(reasonCode, notes, photo) – called to end downtime
 *   disabled – hide pause when line not running
 */
export default function DowntimeBar({ stationType, activeEvent, downtimeMinutesToday, onPause, onResume, disabled }) {
  const [showReasonModal, setShowReasonModal] = useState(false);

  function handlePause() {
    onPause();
  }

  function handleResume() {
    setShowReasonModal(true);
  }

  async function handleReasonConfirm(reasonCode, notes, photo) {
    setShowReasonModal(false);
    await onResume(reasonCode, notes, photo);
  }

  const durationMin = activeEvent
    ? (Date.now() - new Date(activeEvent.started_at)) / 60000
    : null;

  return (
    <>
      <div className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 border ${
        activeEvent ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {activeEvent ? (
            <>
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-red-700">LINE PAUSED</p>
                <p className="text-xs text-red-500">{durationMin != null ? `${durationMin.toFixed(1)} min` : ''}</p>
              </div>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500">
                Downtime today: <b className="text-slate-700">{downtimeMinutesToday.toFixed(0)} min</b>
              </p>
            </>
          )}
        </div>

        {activeEvent ? (
          <button
            onClick={handleResume}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shrink-0"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Resume
          </button>
        ) : (
          !disabled && (
            <button
              onClick={handlePause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-200 shrink-0"
            >
              <PauseCircle className="w-3.5 h-3.5" /> Pause
            </button>
          )
        )}
      </div>

      {showReasonModal && (
        <DowntimeReasonModal
          stationType={stationType}
          durationMinutes={durationMin}
          onConfirm={handleReasonConfirm}
          onCancel={() => {
            setShowReasonModal(false);
            // Don't end the downtime — keep paused
          }}
        />
      )}
    </>
  );
}