/**
 * Scan Input
 * QR/barcode input with formatting and validation
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Barcode, AlertCircle } from 'lucide-react';

export default function ScanInput({
  value,
  onChange,
  onScan,
  placeholder = 'Scan QR/Barcode or enter manually...',
  format = null, // 'CRATE', 'PALLET', 'LOT', etc.
  validation = null, // custom validation function
  error = null,
  disabled = false,
}) {
  const [inputError, setInputError] = useState(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setInputError(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      // Scan complete
      if (validation) {
        const err = validation(value);
        if (err) {
          setInputError(err);
          return;
        }
      }
      onScan?.(value);
      onChange('');
    }
  };

  const displayError = inputError || error;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Barcode className="absolute left-3 top-2.5 w-5 h-5 text-slate-400 pointer-events-none" />
        <Input
          value={value}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-11 pl-10 text-base ${displayError ? 'border-red-500' : ''}`}
        />
      </div>

      {displayError && (
        <div className="flex gap-2 p-2 bg-red-50 rounded border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{displayError}</p>
        </div>
      )}

      {format && (
        <p className="text-xs text-slate-500">Format: {format}</p>
      )}
    </div>
  );
}