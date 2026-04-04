import { useState, useRef, useEffect } from 'react';
import { QrCode, X, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QRScanner from '@/components/store/QRScanner';

/**
 * Unified scan input: combines text input + camera in a single field
 * - Type to search/enter value
 * - Or tap camera icon to scan immediately
 * - QRScanner handles the camera overlay
 */
export default function UnifiedScanInput({ label, value, onChange, placeholder, hint }) {
  const [showScanner, setShowScanner] = useState(false);

  function handleScan(scannedValue) {
    onChange(scannedValue);
    setShowScanner(false);
  }

  return (
    <div>
      <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
        <QrCode className="w-3.5 h-3.5" />
        {label}
      </Label>
      <div className="flex gap-2 mt-1">
        <Input
          className="h-11 text-base flex-1 font-mono"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="h-11 w-11 flex items-center justify-center bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-md transition-colors shrink-0"
          title="Scan QR Code"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}

      {showScanner && <QRScanner onScan={handleScan} label={label} />}
    </div>
  );
}