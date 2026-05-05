import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';

/**
 * Date picker that stores value as DD/MM/YYYY string
 */
export default function DatePickerField({ value, onChange, placeholder, label, required, className, minDate }) {
  const [open, setOpen] = useState(false);

  // Parse DD/MM/YYYY to Date
  const parsedDate = value ? parse(value, 'dd/MM/yyyy', new Date()) : null;
  const dateObj = parsedDate && isValid(parsedDate) ? parsedDate : undefined;

  const handleSelect = (date) => {
    if (date) {
      onChange(format(date, 'dd/MM/yyyy'));
    } else {
      onChange('');
    }
    setOpen(false);
  };

  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full mt-1 h-11 md:h-9 justify-start text-left font-normal ${!value ? 'text-muted-foreground' : ''}`}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {value || placeholder || 'DD/MM/YYYY'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleSelect}
            disabled={minDate ? (date) => date < minDate : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}