import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, Filter, Sunrise, Sun, Sunset, Moon } from 'lucide-react';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night' | null;

interface TimelineFiltersProps {
  timePeriod: TimePeriod;
  selectedApp: string | null;
  availableApps: string[];
  onTimePeriodChange: (period: TimePeriod) => void;
  onAppChange: (app: string | null) => void;
}

const timePeriodConfig = {
  morning: {
    label: 'Morning',
    icon: Sunrise,
    description: 'Before 12 PM',
    startHour: 0,
    endHour: 12,
  },
  afternoon: {
    label: 'Afternoon',
    icon: Sun,
    description: '12 PM - 5 PM',
    startHour: 12,
    endHour: 17,
  },
  evening: {
    label: 'Evening',
    icon: Sunset,
    description: '5 PM - 9 PM',
    startHour: 17,
    endHour: 21,
  },
  night: {
    label: 'Night',
    icon: Moon,
    description: 'After 9 PM',
    startHour: 21,
    endHour: 24,
  },
} as const;

export function TimelineFilters({
  timePeriod,
  selectedApp,
  availableApps,
  onTimePeriodChange,
  onAppChange,
}: TimelineFiltersProps) {
  const hasActiveFilters = timePeriod !== null || selectedApp !== null;

  const clearAllFilters = () => {
    onTimePeriodChange(null);
    onAppChange(null);
  };

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filter:</span>
      </div>

      {/* Time Period Filters */}
      <div className="flex items-center gap-1">
        {(Object.keys(timePeriodConfig) as Array<keyof typeof timePeriodConfig>).map(
          (period) => {
            const config = timePeriodConfig[period];
            const Icon = config.icon;
            const isActive = timePeriod === period;

            return (
              <Button
                key={period}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTimePeriodChange(isActive ? null : period)}
                className="h-8"
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {config.label}
              </Button>
            );
          }
        )}
      </div>

      {/* App Filter Dropdown */}
      {availableApps.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={selectedApp ? 'default' : 'outline'}
              size="sm"
              className="h-8"
            >
              {selectedApp || 'Filter by App'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
            {availableApps.map((app) => (
              <DropdownMenuItem
                key={app}
                onClick={() => onAppChange(app === selectedApp ? null : app)}
                className={selectedApp === app ? 'bg-accent' : ''}
              >
                {app}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clear All Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-8 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Helper function to get time period configuration
export function getTimePeriodRange(period: TimePeriod): {
  startHour: number;
  endHour: number;
} | null {
  if (!period) return null;
  return {
    startHour: timePeriodConfig[period].startHour,
    endHour: timePeriodConfig[period].endHour,
  };
}
