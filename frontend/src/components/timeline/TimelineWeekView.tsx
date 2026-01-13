import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Sparkles, Camera } from 'lucide-react';
import { WeekTimelineData, WeekDayData, WeekTimeBlock } from '@/types/timeline';
import { cn } from '@/lib/utils';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface TimelineWeekViewProps {
  data: WeekTimelineData | null;
  onDayClick: (date: string) => void;
}

// Layout constants
const HOUR_COLUMN_WIDTH = 48;
const BLOCK_HEIGHT = 40; // Height per 30-min block
const START_HOUR = -1; // Show from 12am
const END_HOUR = 25; // to 12am (midnight)

// Pre-computed constants (these never change, no need for useMemo)
const VISIBLE_BLOCK_RANGE = {
  startBlock: START_HOUR * 2,
  endBlock: END_HOUR * 2,
};
const VISIBLE_HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

// Category colors for time blocks (using opacity for intensity)
const CATEGORY_BG_COLORS: Record<string, string> = {
  focus: 'bg-green-500',
  meetings: 'bg-red-500',
  comms: 'bg-purple-500',
  other: 'bg-gray-500',
  '': 'bg-gray-300',
};

const INTENSITY_OPACITY: Record<number, string> = {
  0: 'opacity-0',
  1: 'opacity-30',
  2: 'opacity-50',
  3: 'opacity-70',
  4: 'opacity-100',
};

// Format hour label
function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function TimelineWeekView({ data, onDayClick }: TimelineWeekViewProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
      {/* Header row with day names */}
      <div className="flex border-b bg-muted/30">
        {/* Hour column header */}
        <div className="flex-shrink-0" style={{ width: HOUR_COLUMN_WIDTH }} />

        {/* Day headers */}
        {data.days.map((day) => (
          <DayHeader key={day.date} day={day} onClick={() => onDayClick(day.date)} />
        ))}
      </div>

      {/* Scrollable grid area */}
      <ScrollArea className="flex-1">
        <div className="flex">
          {/* Hour labels column */}
          <div className="flex-shrink-0 border-r bg-muted/20" style={{ width: HOUR_COLUMN_WIDTH }}>
            {VISIBLE_HOURS.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-2 text-xs text-muted-foreground"
                style={{ height: BLOCK_HEIGHT * 2 }} // 2 blocks per hour
              >
                <span className="-mt-2">{formatHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {data.days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              VISIBLE_BLOCK_RANGE={VISIBLE_BLOCK_RANGE}
              onClick={() => onDayClick(day.date)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// Day header component
interface DayHeaderProps {
  day: WeekDayData;
  onClick: () => void;
}

function DayHeader({ day, onClick }: DayHeaderProps) {
  const dateNum = new Date(day.date + 'T00:00:00').getDate();

  return (
    <div
      className={cn(
        'flex-1 min-w-[100px] px-2 py-2 cursor-pointer transition-colors hover:bg-muted/50',
        day.isToday && 'bg-primary/5'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={cn(
            'text-xs font-medium',
            day.isToday ? 'text-primary' : 'text-muted-foreground'
          )}>
            {day.dayName}
          </div>
          <div className={cn(
            'text-lg font-semibold',
            day.isToday && 'text-primary'
          )}>
            {dateNum}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="text-xs font-medium text-muted-foreground">
            {formatDecimalHours(day.totalHours)}
          </div>
          <div className="flex items-center gap-1">
            {day.hasAiSummary && (
              <Sparkles className="h-3 w-3 text-amber-500" />
            )}
            {day.screenshotCount > 0 && (
              <div className="flex items-center gap-0.5">
                <Camera className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{day.screenshotCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Day column component
interface DayColumnProps {
  day: WeekDayData;
  VISIBLE_BLOCK_RANGE: { startBlock: number; endBlock: number };
  onClick: () => void;
}

function DayColumn({ day, VISIBLE_BLOCK_RANGE, onClick }: DayColumnProps) {
  const { startBlock, endBlock } = VISIBLE_BLOCK_RANGE;

  return (
    <div
      className={cn(
        'flex-1 min-w-[100px] border-r last:border-r-0 cursor-pointer transition-colors hover:bg-muted/30',
        day.isToday && 'bg-primary/5'
      )}
      onClick={onClick}
    >
      {day.timeBlocks
        .filter((block) => block.blockIndex >= startBlock && block.blockIndex < endBlock)
        .map((block) => (
          <TimeBlockCell key={block.blockIndex} block={block} />
        ))}
    </div>
  );
}

// Individual time block cell
interface TimeBlockCellProps {
  block: WeekTimeBlock;
}

function TimeBlockCell({ block }: TimeBlockCellProps) {
  const bgColor = block.hasActivity && block.dominantCategory
    ? (CATEGORY_BG_COLORS[block.dominantCategory] || CATEGORY_BG_COLORS['other'])
    : '';
  const opacity = block.hasActivity ? INTENSITY_OPACITY[block.intensity] : '';

  return (
    <div
      className="relative border-b border-muted/50"
      style={{ height: BLOCK_HEIGHT }}
    >
      {block.hasActivity && (
        <div
          className={cn(
            'absolute inset-0.5 rounded-sm transition-opacity',
            bgColor,
            opacity
          )}
        />
      )}
    </div>
  );
}

// Skeleton for loading state
const SKELETON_DAYS = Array.from({ length: 7 }, (_, i) => i);

export function TimelineWeekViewSkeleton() {

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="flex border-b bg-muted/30">
        <div className="flex-shrink-0" style={{ width: HOUR_COLUMN_WIDTH }} />
        {SKELETON_DAYS.map((i) => (
          <div key={i} className="flex-1 min-w-[100px] px-2 py-2">
            <div className="h-4 w-8 bg-muted rounded mb-1" />
            <div className="h-6 w-6 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="flex flex-1">
        <div className="flex-shrink-0 border-r bg-muted/20" style={{ width: HOUR_COLUMN_WIDTH }}>
          {VISIBLE_HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end pr-2"
              style={{ height: BLOCK_HEIGHT * 2 }}
            >
              <div className="h-3 w-6 bg-muted rounded -mt-1.5" />
            </div>
          ))}
        </div>
        {SKELETON_DAYS.map((i) => (
          <div key={i} className="flex-1 min-w-[100px] border-r last:border-r-0">
            {VISIBLE_HOURS.flatMap((h) => [h * 2, h * 2 + 1]).map((blockIdx) => (
              <div
                key={blockIdx}
                className="border-b border-muted/50"
                style={{ height: BLOCK_HEIGHT }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
