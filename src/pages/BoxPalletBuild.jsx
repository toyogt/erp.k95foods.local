import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ChevronRight } from 'lucide-react';
import PalletIdStep from '@/components/pallets/PalletIdStep';
import BoxScanStep from '@/components/pallets/BoxScanStep';
import SealAndPrint from '@/components/pallets/SealAndPrint';
import HandoverStep from '@/components/pallets/HandoverStep';

const STEPS = ['Pallet ID', 'Scan Boxes', 'Seal & Print', 'Handover'];

export default function BoxPalletBuild() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0); // 0-3
  const [pallet, setPallet] = useState(null);
  const [scannedBoxes, setScannedBoxes] = useState([]);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function handlePalletOpened(p) {
    if (p._preloadedBoxes) {
      const { _preloadedBoxes, ...clean } = p;
      setPallet(clean);
      setScannedBoxes(_preloadedBoxes);
      setStep(1);
    } else {
      setPallet(p);
      setScannedBoxes([]);
      setStep(1);
    }
  }

  function handleSealRequest() {
    setStep(2);
  }

  function handleSealed() {
    // stays on step 2 for printing
  }

  function handleHandoverReady() {
    setStep(3);
  }

  function handleComplete() {
    // Reset all for next pallet
    setPallet(null);
    setScannedBoxes([]);
    setStep(0);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Pallet Build</h2>
        <p className="text-sm text-slate-500">Scan boxes to build, seal and hand over FG pallets.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-slate-200 px-4 py-3">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`flex items-center gap-1.5 flex-1 min-w-0 ${i > step ? 'opacity-40' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-semibold truncate ${i === step ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <PalletIdStep user={user} onPalletOpened={handlePalletOpened} />
      )}

      {step === 1 && pallet && (
        <BoxScanStep
          pallet={pallet}
          user={user}
          scannedBoxes={scannedBoxes}
          setScannedBoxes={setScannedBoxes}
          onSealRequest={handleSealRequest}
        />
      )}

      {step === 2 && pallet && (
        <SealAndPrint
          pallet={pallet}
          scannedBoxes={scannedBoxes}
          user={user}
          onSealed={handleSealed}
          onHandoverReady={handleHandoverReady}
        />
      )}

      {step === 3 && pallet && (
        <HandoverStep
          pallet={pallet}
          user={user}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}