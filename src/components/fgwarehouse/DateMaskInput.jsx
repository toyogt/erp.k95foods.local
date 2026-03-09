import { useState, useEffect } from 'react';

const toDisplay = (iso) => {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

export default function DateMaskInput({ value, onChange, placeholder = 'DD/MM/YYYY', className = '' }) {
  const [display, setDisplay] = useState(() => toDisplay(value));

  // Sync display when value is externally reset (e.g. form reset)
  useEffect(() => {
    if (!value) setDisplay('');
    else {
      const d = toDisplay(value);
      if (d) setDisplay(d);
    }
  }, [value]);

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    setDisplay(formatted);
    if (digits.length === 8) {
      const iso = `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) onChange(iso);
      else onChange('');
    } else {
      onChange('');
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={`flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
    />
  );
}