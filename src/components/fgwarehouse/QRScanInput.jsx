import { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

export default function QRScanInput({ onScan, placeholder = "Scan QR or type ID…" }) {
  const [scanning, setScanning] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);

  const startScan = async () => {
    setError('');
    if (!('BarcodeDetector' in window)) {
      setError('QR camera scan not supported on this browser. Type the lot ID and press Enter.');
      return;
    }
    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
    } catch {
      setError('Camera access denied. Type the lot ID manually.');
    }
  };

  useEffect(() => {
    if (scanning && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play();
      const loop = async () => {
        if (!videoRef.current || !detectorRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes.length > 0) {
            stopScan();
            onScan(codes[0].rawValue);
            return;
          }
        } catch {}
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [scanning]);

  const stopScan = () => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScan(), []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue('');
    }
  };

  return (
    <div className="space-y-2">
      {scanning && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-48 object-cover" playsInline muted />
          <div className="absolute inset-0 border-2 border-white/40 m-10 rounded-xl pointer-events-none" />
          <button onClick={stopScan} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-xl">
            <X className="w-4 h-4" />
          </button>
          <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs font-semibold">Point camera at QR code</p>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={manualValue}
          onChange={e => setManualValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          style={{ fontSize: '16px' }}
        />
        <button
          type="button"
          onClick={scanning ? stopScan : startScan}
          className={`flex items-center justify-center px-4 rounded-xl border font-semibold text-sm transition-colors min-h-[52px] min-w-[56px] ${
            scanning
              ? 'bg-red-50 border-red-300 text-red-600'
              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 active:bg-slate-300'
          }`}
        >
          {scanning ? <X className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}