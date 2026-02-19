import { useRef, useEffect } from 'react';
import { ScanLine } from 'lucide-react';

export default function ScanInput({ placeholder = 'Scan barcode…', onScan, value, onChange, autoFocus = true }) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  function handleKey(e) {
    if (e.key === 'Enter' && value?.trim()) {
      onScan(value.trim());
    }
  }

  return (
    <div className="relative">
      <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-blue-500 focus:outline-none bg-white"
      />
    </div>
  );
}