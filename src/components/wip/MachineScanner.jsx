import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ScanInput from './ScanInput';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function MachineScanner({ stationType, onConfirmed }) {
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [machine, setMachine] = useState(null);

  async function handleScan(val) {
    setLoading(true);
    setError('');
    try {
      const machines = await base44.entities.Machine.filter({ machine_id: val });
      const m = machines[0];
      if (!m) { setError('Machine not found: ' + val); setScan(''); setLoading(false); return; }
      if (stationType && m.machine_type !== stationType) {
        setError(`Wrong station type. Expected ${stationType}, got ${m.machine_type}`);
        setScan(''); setLoading(false); return;
      }
      setMachine(m);
    } catch {
      // offline fallback — accept any scan
      setMachine({ machine_id: val, display_name: val, default_location: '' });
    }
    setLoading(false);
  }

  if (machine) {
    return (
      <div className="rounded-2xl bg-slate-900 text-white p-5 flex items-center gap-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Station</p>
          <p className="text-xl font-bold">{machine.display_name}</p>
          {machine.default_location && <p className="text-sm text-slate-300 mt-0.5">{machine.default_location}</p>}
        </div>
        <Button variant="ghost" size="sm" className="ml-auto text-slate-400 hover:text-white" onClick={() => { setMachine(null); setScan(''); onConfirmed(null); }}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Scan Machine QR</p>
      <ScanInput placeholder="Scan machine QR code…" value={scan} onChange={setScan} onScan={handleScan} />
      {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {error && <p className="text-sm text-red-600 font-medium px-1">{error}</p>}
      <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => handleScan(scan)} disabled={!scan.trim() || loading}>
        Confirm
      </Button>
    </div>
  );
}