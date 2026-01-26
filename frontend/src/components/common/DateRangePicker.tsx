import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn, isSameDay } from '@/lib/utils';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: Date;
  maxDate?: Date;
  trigger?: React.ReactNode;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DateRangePicker({ value, onChange, minDate, maxDate, trigger }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value.start);
  const [selectionStart, setSelectionStart] = useState<Date | null>(value.start);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(value.end);
  const [selectingEnd, setSelectingEnd] = useState(false);

  // Sync internal state when value changes externally (e.g., navigation buttons)
  useEffect(() => {
    setViewDate(value.start);
    setSelectionStart(value.start);
    setSelectionEnd(value.end);
    setSelectingEnd(false);
  }, [value.start, value.end]);

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

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);

    if (!selectingEnd) {
      // First click - set start date
      setSelectionStart(clickedDate);
      setSelectionEnd(null);
      setSelectingEnd(true);
    } else {
      // Second click - set end date
      if (selectionStart && clickedDate >= selectionStart) {
        setSelectionEnd(clickedDate);
      } else {
        // If clicked date is before start, make it the new start
        setSelectionStart(clickedDate);
        setSelectionEnd(null);
        return;
      }
      setSelectingEnd(false);
    }
  };

  const handleApply = () => {
    if (selectionStart && selectionEnd) {
      onChange({ start: selectionStart, end: selectionEnd });
      setOpen(false);
    }
  };

  const handleCancel = () => {
    setSelectionStart(value.start);
    setSelectionEnd(value.end);
    setSelectingEnd(false);
    setOpen(false);
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    setSelectionStart(start);
    setSelectionEnd(end);
    setSelectingEnd(false);
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
    const date = new Date(year, month, day);
    if (selectionStart && isSameDay(date, selectionStart)) return true;
    if (selectionEnd && isSameDay(date, selectionEnd)) return true;
    return false;
  };

  const isInRange = (day: number) => {
    if (!selectionStart || !selectionEnd) return false;
    const date = new Date(year, month, day);
    return date > selectionStart && date < selectionEnd;
  };

  const isRangeStart = (day: number) => {
    if (!selectionStart) return false;
    return isSameDay(new Date(year, month, day), selectionStart);
  };

  const isRangeEnd = (day: number) => {
    if (!selectionEnd) return false;
    return isSameDay(new Date(year, month, day), selectionEnd);
  };

  // Generate calendar grid
  const days: (number | null)[] = [];
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const rangeLabel = `${formatDate(value.start)} - ${formatDate(value.end)}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            {rangeLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-auto p-4">
        <DialogHeader>
          <DialogTitle>Select Date Range</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Selection Status */}
          <div className="text-sm text-muted-foreground text-center">
            {selectingEnd ? (
              selectionStart ? (
                <span>Select end date (started: {formatDate(selectionStart)})</span>
              ) : (
                <span>Select start date</span>
              )
            ) : selectionStart && selectionEnd ? (
              <span className="text-foreground font-medium">
                {formatDate(selectionStart)} - {formatDate(selectionEnd)}
              </span>
            ) : (
              <span>Select start date</span>
            )}
          </div>

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
                    onClick={() => handleDayClick(day)}
                    disabled={isDisabled(day)}
                    className={cn(
                      'w-full h-full text-sm flex items-center justify-center transition-colors relative',
                      // Range highlighting
                      isInRange(day) && 'bg-primary/20',
                      // Start/end selection
                      isRangeStart(day) && 'rounded-l-md bg-primary text-primary-foreground',
                      isRangeEnd(day) && 'rounded-r-md bg-primary text-primary-foreground',
                      // Single selection (both start and end same day)
                      isRangeStart(day) && isRangeEnd(day) && 'rounded-md',
                      // Selected but not start/end
                      isSelected(day) && !isRangeStart(day) && !isRangeEnd(day) && 'bg-primary text-primary-foreground rounded-md',
                      // Today indicator
                      isToday(day) && !isSelected(day) && !isInRange(day) && 'bg-accent text-accent-foreground rounded-md',
                      // Hover state
                      !isSelected(day) && !isInRange(day) && 'hover:bg-accent rounded-md',
                      // Disabled state
                      isDisabled(day) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Quick Select Options */}
          <div className="flex gap-2 pt-2 border-t flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuickSelect(7)}
            >
              Last 7 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuickSelect(14)}
            >
              Last 14 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuickSelect(30)}
            >
              Last 30 days
            </Button>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectionStart || !selectionEnd}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
