import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import type { TimeRange } from '@/types';

interface TimeRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  parsedRange: TimeRange | undefined;
}

const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this week' },
  { label: 'Last Week', value: 'last week' },
  { label: 'Past 3 Days', value: 'past 3 days' },
  { label: 'Past 7 Days', value: 'past 7 days' },
  { label: 'This Month', value: 'this month' },
  { label: 'Last Month', value: 'last month' },
];

export function TimeRangeSelector({ value, onChange, parsedRange }: TimeRangeSelectorProps) {
  const [inputValue, setInputValue] = useState(value);

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Time Range
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Custom Input */}
        <div className="space-y-2">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="today, yesterday, past 3 days, Jan 1 - Jan 15..."
            className="font-mono text-sm"
          />
          {parsedRange && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDate(parsedRange.start)}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{formatDate(parsedRange.end)}</span>
            </div>
          )}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Badge
              key={preset.value}
              variant={value === preset.value ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-accent transition-colors"
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
