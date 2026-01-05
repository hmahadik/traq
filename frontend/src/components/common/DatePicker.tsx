import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn, addDays, isSameDay } from '@/lib/utils';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  trigger?: React.ReactNode;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DatePicker({ value, onChange, minDate, maxDate, trigger }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const goToPreviousMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const selectDate = (day: number) => {
    const newDate = new Date(year, month, day);
    onChange(newDate);
    setOpen(false);
  };

  const isDisabled = (day: number) => {
    const date = new Date(year, month, day);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isToday = (day: number) => {
    return isSameDay(new Date(year, month, day), new Date());
  };

  const isSelected = (day: number) => {
    return isSameDay(new Date(year, month, day), value);
  };

  // Generate calendar grid
  const days: (number | null)[] = [];
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            {value.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-auto p-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Select date</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold">
              {MONTHS[month]} {year}
            </span>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((day) => (
              <div key={day} className="text-xs font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day !== null && (
                  <button
                    onClick={() => selectDate(day)}
                    disabled={isDisabled(day)}
                    className={cn(
                      'w-full h-full rounded-md text-sm flex items-center justify-center transition-colors',
                      isSelected(day)
                        ? 'bg-primary text-primary-foreground'
                        : isToday(day)
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent',
                      isDisabled(day) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                onChange(new Date());
                setOpen(false);
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                onChange(addDays(new Date(), -1));
                setOpen(false);
              }}
            >
              Yesterday
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
