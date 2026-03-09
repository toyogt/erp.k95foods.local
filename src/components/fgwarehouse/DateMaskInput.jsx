import { useState, useEffect } from 'react';

const toDisplay = (iso) => {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

export default function DateMaskInput({
  value,
  onChange,
  onComplete,
  placeholder = 'DD/MM/YYYY',
  className = '',
  readOnly = false,
  id,
  nextFieldId,
}) {
  const [display, setDisplay] = useState(() => toDisplay(value));

  useEffect(() => {
    if (!value) setDisplay('');
    else {
      const d = toDisplay(value);
      if (d) setDisplay(d);
    }
  }, [value]);

  const handleChange = (e) => {
    if (readOnly) return;
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
      if (!isNaN(date.getTime())) {
        onChange(iso);
        if (onComplete) onComplete(iso);
        if (nextFieldId) {
          setTimeout(() => {
            const el = document.getElementById(nextFieldId);
            if (el) { el.focus(); if (el.select) el.select(); }
          }, 50);
        }
      } else onChange('');
    } else {
      onChange('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && nextFieldId) {
      e.preventDefault();
      const el = document.getElementById(nextFieldId);
      if (el) { el.focus(); if (el.select) el.select(); }
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`flex h-11 w-full rounded-xl border bg-white px-3 py-2 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${readOnly ? 'border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-slate-200'} ${className}`}
    />
  );
}