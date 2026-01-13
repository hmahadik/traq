import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Calendar, ArrowRight, CalendarDays } from 'lucide-react';
import type { TimeRange } from '@/types';
import { DateRangePicker, type DateRange } from '../common';

interface TimeRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  parsedRange: TimeRange | undefined;
}

const PRESETS = [
  { label: 'Today', value: 'Today' },
  { label: 'Yesterday', value: 'Yesterday' },
  { label: 'This Week', value: 'This Week' },
  { label: 'Last Week', value: 'Last Week' },
  { label: 'This Month', value: 'This Month' },
];

function formatDateRangeForInput(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = range.start.toLocaleDateString('en-US', opts);
  const end = range.end.toLocaleDateString('en-US', opts);
  return `${start} - ${end}`;
}

export function TimeRangeSelector({ value, onChange, parsedRange }: TimeRangeSelectorProps) {
  const [inputValue, setInputValue] = useState(value);

  // Default date range for picker (today to today if no parsed range)
  const defaultRange: DateRange = parsedRange
    ? { start: new Date(parsedRange.start * 1000), end: new Date(parsedRange.end * 1000) }
    : { start: new Date(), end: new Date() };

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (inputValue !== value) {
      onChange(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onChange(inputValue);
    }
  };

  const handlePresetClick = (preset: string) => {
    setInputValue(preset);
    onChange(preset);
  };

  const handleDateRangeChange = (range: DateRange) => {
    const formatted = formatDateRangeForInput(range);
    setInputValue(formatted);
    onChange(formatted);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Time Range
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="today, yesterday, Jan 1 - Jan 15..."
            className="font-mono text-sm flex-1"
          />
          <DateRangePicker
            value={defaultRange}
            onChange={handleDateRangeChange}
            maxDate={new Date()}
            trigger={
              <Button variant="outline" size="icon" className="shrink-0">
                <CalendarDays className="h-4 w-4" />
              </Button>
            }
          />
        </div>

        {parsedRange && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(parsedRange.start)}</span>
            <ArrowRight className="h-3 w-3" />
            <span>{formatDate(parsedRange.end)}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Badge
              key={preset.value}
              variant={value === preset.value ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => handlePresetClick(preset.value)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
