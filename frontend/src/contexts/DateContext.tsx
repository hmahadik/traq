import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type TimeframeType = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateContextValue {
  // Current selected date (for single-day views)
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  // Current timeframe type (day/week/month/year/custom)
  timeframeType: TimeframeType;
  setTimeframeType: (type: TimeframeType) => void;

  // Date range for multi-day timeframes
  dateRange: DateRange | null;
  setDateRange: (range: DateRange | null) => void;

  // Helpers
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  goToYesterday: () => void;
  isToday: boolean;

  // Get the appropriate representative date for Timeline
  // For multi-day ranges, returns end date (capped at today)
  // For day view, returns selectedDate
  getRepresentativeDate: () => Date;
}

const DateContext = createContext<DateContextValue | undefined>(undefined);

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeframeType, setTimeframeType] = useState<TimeframeType>('day');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const today = new Date();
  const isToday = getDateString(selectedDate) === getDateString(today);

  const goToPreviousDay = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    const nextDay = addDays(selectedDate, 1);
    const today = new Date();
    // Don't allow going past today
    if (getDateString(nextDay) <= getDateString(today)) {
      setSelectedDate(nextDay);
    }
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const goToYesterday = useCallback(() => {
    setSelectedDate(addDays(new Date(), -1));
  }, []);

  const getRepresentativeDate = useCallback(() => {
    // For day view or when no dateRange is set, use selectedDate
    if (timeframeType === 'day' || !dateRange) {
      return selectedDate;
    }

    // For multi-day views, use end date of range, capped at today
    const today = new Date();
    const endDate = dateRange.end;

    // If end date is in the future, cap at today
    if (getDateString(endDate) > getDateString(today)) {
      return today;
    }

    return endDate;
  }, [timeframeType, dateRange, selectedDate]);

  const value: DateContextValue = {
    selectedDate,
    setSelectedDate,
    timeframeType,
    setTimeframeType,
    dateRange,
    setDateRange,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    goToYesterday,
    isToday,
    getRepresentativeDate,
  };

  return <DateContext.Provider value={value}>{children}</DateContext.Provider>;
}

export function useDateContext() {
  const context = useContext(DateContext);
  if (context === undefined) {
    throw new Error('useDateContext must be used within a DateProvider');
  }
  return context;
}
