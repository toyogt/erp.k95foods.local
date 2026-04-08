import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * NumericInput — standardized numeric input across the app
 * - Hides stepper/scroll controls
 * - Prevents negative values
 * - Supports min/max/step
 */
const NumericInput = forwardRef(({ className, min = 0, onWheel, onChange, ...props }, ref) => {
  // Prevent scroll changing value
  const handleWheel = (e) => {
    e.target.blur();
    if (onWheel) onWheel(e);
  };

  // Prevent negative values
  const handleChange = (e) => {
    const val = e.target.value;
    // Allow empty or valid positive numbers
    if (val === '' || parseFloat(val) >= 0 || val === '-') {
      if (onChange) onChange(e);
    }
  };

  const handleKeyDown = (e) => {
    // Prevent minus key
    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
    }
  };

  return (
    <input
      type="number"
      ref={ref}
      min={min}
      onWheel={handleWheel}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  );
});

NumericInput.displayName = "NumericInput";

export { NumericInput };
export default NumericInput;