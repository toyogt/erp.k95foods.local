import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

const PRESET_BATCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function LblBatchSelect({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const inputRef = useRef(null);

  const isPreset = PRESET_BATCHES.includes(value);
  const isCustom = value && !isPreset;

  useEffect(() => {
    if (showCustom && inputRef.current) inputRef.current.focus();
  }, [showCustom]);

  const handlePresetClick = (num) => {
    onChange(num);
    setShowCustom(false);
    setCustomVal('');
  };

  const handleCustomSubmit = () => {
    const trimmed = customVal.trim();
    if (trimmed) {
      onChange(trimmed);
      setShowCustom(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setCustomVal('');
    setShowCustom(false);
  };

  return (
    <div className="space-y-2">
      {/* Preset batch number grid */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_BATCHES.map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handlePresetClick(num)}
            className={`h-9 w-9 rounded-md text-sm font-medium border transition-colors ${
              value === num
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors flex items-center gap-1.5 ${
            isCustom
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          {isCustom ? value : 'Custom'}
        </button>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="h-9 w-9 rounded-md text-sm border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors flex items-center justify-center"
            title="Clear batch"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Custom input */}
      {showCustom && !isCustom && (
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomSubmit(); } }}
            placeholder="Enter custom batch number"
            className="h-11 md:h-9 flex-1"
          />
          <Button type="button" size="sm" className="h-11 md:h-9 px-4" onClick={handleCustomSubmit} disabled={!customVal.trim()}>
            Add
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" onClick={() => setShowCustom(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}