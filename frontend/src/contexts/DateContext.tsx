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

  // Helpers - Day navigation
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  goToYesterday: () => void;
  isToday: boolean;

  // Helpers - Week navigation
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;

  // Helpers - Month navigation
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;

  // Helpers - Year navigation
  goToPreviousYear: () => void;
  goToNextYear: () => void;

  // Smart navigation based on current timeframeType
  goToPrevious: () => void;
  goToNext: () => void;
  canGoNext: boolean; // False if at current period

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

  // Day navigation
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

  // Week navigation
  const goToPreviousWeek = useCallback(() => {
    setSelectedDate((d) => addDays(d, -7));
  }, []);

  const goToNextWeek = useCallback(() => {
    const nextWeek = addDays(selectedDate, 7);
    const today = new Date();
    // Don't allow going past today
    if (getDateString(nextWeek) <= getDateString(today)) {
      setSelectedDate(nextWeek);
    }
  }, [selectedDate]);

  // Month navigation
  const goToPreviousMonth = useCallback(() => {
    setSelectedDate((d) => {
      const newDate = new Date(d);
      newDate.setMonth(d.getMonth() - 1);
      return newDate;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedDate((d) => {
      const nextMonth = new Date(d);
      nextMonth.setMonth(d.getMonth() + 1);
      const today = new Date();
      // Don't allow going past current month
      if (getDateString(nextMonth) <= getDateString(today)) {
        return nextMonth;
      }
      return d;
    });
  }, []);

  // Year navigation
  const goToPreviousYear = useCallback(() => {
    setSelectedDate((d) => {
      const newDate = new Date(d);
      newDate.setFullYear(d.getFullYear() - 1);
      return newDate;
    });
  }, []);

  const goToNextYear = useCallback(() => {
    setSelectedDate((d) => {
      const nextYear = new Date(d);
      nextYear.setFullYear(d.getFullYear() + 1);
      const today = new Date();
      // Don't allow going past current year
      if (nextYear.getFullYear() <= today.getFullYear()) {
        return nextYear;
      }
      return d;
    });
  }, []);

  // Smart navigation based on timeframeType
  const goToPrevious = useCallback(() => {
    switch (timeframeType) {
      case 'day':
        goToPreviousDay();
        break;
      case 'week':
        goToPreviousWeek();
        break;
      case 'month':
        goToPreviousMonth();
        break;
      case 'year':
        goToPreviousYear();
        break;
      case 'custom':
        // For custom, move by the inclusive range length (duration + 1 day)
        // so ranges tile without overlap: Mon-Sun → prev Mon-prev Sun
        if (dateRange) {
          const rangeDays = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
          const newStart = addDays(dateRange.start, -rangeDays);
          const newEnd = addDays(dateRange.end, -rangeDays);
          setDateRange({ start: newStart, end: newEnd });
        }
        break;
    }
  }, [timeframeType, goToPreviousDay, goToPreviousWeek, goToPreviousMonth, goToPreviousYear, dateRange]);

  const goToNext = useCallback(() => {
    switch (timeframeType) {
      case 'day':
        goToNextDay();
        break;
      case 'week':
        goToNextWeek();
        break;
      case 'month':
        goToNextMonth();
        break;
      case 'year':
        goToNextYear();
        break;
      case 'custom':
        // For custom, move by the inclusive range length (duration + 1 day)
        // so ranges tile without overlap: Mon-Sun → next Mon-next Sun
        if (dateRange) {
          const rangeDays = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
          const newStart = addDays(dateRange.start, rangeDays);
          const newEnd = addDays(dateRange.end, rangeDays);
          const today = new Date();
          // Don't go past today
          if (getDateString(newEnd) <= getDateString(today)) {
            setDateRange({ start: newStart, end: newEnd });
          }
        }
        break;
    }
  }, [timeframeType, goToNextDay, goToNextWeek, goToNextMonth, goToNextYear, dateRange]);

  // Calculate if we can go to next period
  const canGoNext = useCallback(() => {
    const today = new Date();
    switch (timeframeType) {
      case 'day':
        return getDateString(selectedDate) < getDateString(today);
      case 'week': {
        const nextWeek = addDays(selectedDate, 7);
        return getDateString(nextWeek) <= getDateString(today);
      }
      case 'month': {
        const nextMonth = new Date(selectedDate);
        nextMonth.setMonth(selectedDate.getMonth() + 1);
        return getDateString(nextMonth) <= getDateString(today);
      }
      case 'year': {
        return selectedDate.getFullYear() < today.getFullYear();
      }
      case 'custom': {
        if (!dateRange) return false;
        const rangeDays = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
        const newEnd = addDays(dateRange.end, rangeDays);
        return getDateString(newEnd) <= getDateString(today);
      }
    }
    return false;
  }, [timeframeType, selectedDate, dateRange])();

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
    goToPreviousWeek,
    goToNextWeek,
    goToPreviousMonth,
    goToNextMonth,
    goToPreviousYear,
    goToNextYear,
    goToPrevious,
    goToNext,
    canGoNext,
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
