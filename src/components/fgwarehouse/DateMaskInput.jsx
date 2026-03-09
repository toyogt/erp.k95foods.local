import { useState, useEffect } from 'react';

const toDisplay = (iso) => {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

export const focusNext = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const all = Array.from(document.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled])'));
    const idx = all.indexOf(e.target);
    if (idx >= 0 && all[idx + 1]) all[idx + 1].focus();
  }
};

export default function DateMaskInput({ value, onChange, placeholder = 'DD/MM/YYYY', className = '', maxToday = false, minDate = '' }) {
  const [display, setDisplay] = useState(() => toDisplay(value));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value) { setDisplay(''); setError(''); }
    else {
      const d = toDisplay(value);
      if (d) setDisplay(d);
    }
  }, [value]);

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length <= 2) formatted = digits;
    else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    else formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;

    setDisplay(formatted);
    setError('');

    if (digits.length === 8) {
      const iso = `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
      const date = new Date(iso);
      if (isNaN(date.getTime())) { setError('Invalid date'); onChange(''); return; }
      if (maxToday && iso > new Date().toISOString().split('T')[0]) {
        setError('Date cannot be in the future');
        onChange(''); return;
      }
      if (minDate && iso <= minDate) {
        setError(`Must be after ${toDisplay(minDate)}`);
        onChange(''); return;
      }
      onChange(iso);
    } else {
      onChange('');
    }
  };

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onKeyDown={focusNext}
        placeholder={placeholder}
        className={`flex h-11 w-full rounded-xl border ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'} px-3 py-2 text-base shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 ${className}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}