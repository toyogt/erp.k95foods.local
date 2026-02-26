import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import PalletIdStep from '@/components/pallets/PalletIdStep';
import BoxScanStep from '@/components/pallets/BoxScanStep';
import SealAndPrint from '@/components/pallets/SealAndPrint';
import HandoverStep from '@/components/pallets/HandoverStep';

const STEPS = ['Pallet ID', 'Scan Boxes', 'Seal & Print', 'Photo Proof'];

export default function BoxPalletBuild() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [pallet, setPallet] = useState(null);
  const [scannedBoxes, setScannedBoxes] = useState([]);
  const [backLoading, setBackLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.ProductMaster.filter({ is_active: true }, 'product_name', 500),
    ]).then(([u, prods]) => {
      setUser(u);
      setProducts(prods);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function handlePalletOpened(p) {
    if (p._preloadedBoxes) {
      const { _preloadedBoxes, ...clean } = p;
      setPallet(clean);
      setScannedBoxes(_preloadedBoxes);
    } else {
      setPallet(p);
      setScannedBoxes([]);
    }
    setStep(1);
  }

  function handleSealRequest() { setStep(2); }
  function handleSealed(data) { if (data) setPallet(prev => ({ ...prev, ...data })); }
  function handleHandoverReady() { setStep(3); }
  function handleComplete() { setPallet(null); setScannedBoxes([]); setStep(0); }

  async function handleBackToScan() {
    setBackLoading(true);
    if (pallet?.status === 'SEALED') {
      await base44.entities.BoxPallet.update(pallet.id, { status: 'OPEN' });
      setPallet(prev => ({ ...prev, status: 'OPEN', sealed_at: null }));
    }
    setBackLoading(false);
    setStep(1);
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
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-slate-200 px-3 py-3 overflow-x-auto">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1.5 ${i > step ? 'opacity-40' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i === step && (
                <span className="text-sm font-bold text-slate-900 whitespace-nowrap">{label}</span>
              )}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 mx-0.5" />}
          </div>
        ))}
      </div>

      {/* Back button for steps 2 and 3 */}
      {(step === 2 || step === 3) && (
        <button
          onClick={step === 2 ? handleBackToScan : () => setStep(2)}
          disabled={backLoading}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
        >
          {backLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Reopening pallet…</>
            : <><ChevronLeft className="w-4 h-4" />{step === 2 ? 'Back to Scanning' : 'Back to Seal & Print'}</>
          }
        </button>
      )}

      {step === 0 && <PalletIdStep user={user} onPalletOpened={handlePalletOpened} />}

      {step === 1 && pallet && (
        <BoxScanStep
          pallet={pallet}
          user={user}
          products={products}
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