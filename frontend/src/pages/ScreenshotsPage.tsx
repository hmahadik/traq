import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Image,
  Loader2,
  X,
  ZoomIn,
  Check,
} from 'lucide-react';
import { useScreenshotsForDate, useScreenshotsForHour, useDeleteScreenshot } from '@/api/hooks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Helper to extract string from sql.NullString or plain string
function extractString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as { String?: string; Valid?: boolean };
    if (obj.Valid && obj.String) return obj.String;
  }
  return '';
}

export function ScreenshotsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedScreenshots, setSelectedScreenshots] = useState<Set<number>>(new Set());
  const [filterApp, setFilterApp] = useState<string>('all');
  const [filterHour, setFilterHour] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewScreenshot, setPreviewScreenshot] = useState<{
    id: number;
    timestamp: number;
    filepath: string;
    appName?: unknown;
    windowTitle?: unknown;
    sessionId?: number | null;
  } | null>(null);

  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  // Fetch screenshots - use hour-specific hook if hour filter is active
  const hourNum = filterHour !== 'all' ? parseInt(filterHour, 10) : null;
  const { data: screenshotsByDate, isLoading: isLoadingDate, refetch: refetchDate } =
    useScreenshotsForDate(dateStr, { enabled: hourNum === null });
  const { data: screenshotsByHour, isLoading: isLoadingHour, refetch: refetchHour } =
    useScreenshotsForHour(dateStr, hourNum ?? 0, { enabled: hourNum !== null });

  const screenshots = hourNum !== null ? screenshotsByHour : screenshotsByDate;
  const isLoading = hourNum !== null ? isLoadingHour : isLoadingDate;
  const refetch = hourNum !== null ? refetchHour : refetchDate;
  const deleteScreenshot = useDeleteScreenshot();

  // Get unique apps from current screenshots
  const uniqueApps = useMemo(() => {
    if (!screenshots) return [];
    const apps = new Set<string>();
    for (const s of screenshots) {
      const appName = extractString(s.appName);
      if (appName) apps.add(appName);
    }
    return Array.from(apps).sort();
  }, [screenshots]);

  // Get unique hours from current screenshots (for hour filter dropdown)
  const uniqueHours = useMemo(() => {
    if (!screenshotsByDate) return [];
    const hours = new Set<number>();
    for (const s of screenshotsByDate) {
      const date = new Date(s.timestamp * 1000);
      hours.add(date.getHours());
    }
    return Array.from(hours).sort((a, b) => a - b);
  }, [screenshotsByDate]);

  // Filter screenshots
  const filteredScreenshots = useMemo(() => {
    if (!screenshots) return [];
    return screenshots.filter((s) => {
      // App filter
      if (filterApp !== 'all') {
        const appName = extractString(s.appName);
        if (appName !== filterApp) return false;
      }
      // Search filter (matches window title)
      if (searchQuery) {
        const windowTitle = extractString(s.windowTitle);
        if (!windowTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [screenshots, filterApp, searchQuery]);

  // Navigation handlers
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
    setSelectedScreenshots(new Set());
    setFilterHour('all');
  }, []);

  const goToNextDay = useCallback(() => {
    if (!isToday) {
      setSelectedDate((d) => addDays(d, 1));
      setSelectedScreenshots(new Set());
      setFilterHour('all');
    }
  }, [isToday]);

  // Selection handlers
  const toggleScreenshot = useCallback((id: number) => {
    setSelectedScreenshots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!filteredScreenshots) return;
    setSelectedScreenshots(new Set(filteredScreenshots.map((s) => s.id)));
  }, [filteredScreenshots]);

  const clearSelection = useCallback(() => {
    setSelectedScreenshots(new Set());
  }, []);

  // Delete handler
  const handleDeleteSelected = useCallback(async () => {
    if (selectedScreenshots.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedScreenshots.size} screenshot(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedScreenshots) {
      try {
        await deleteScreenshot.mutateAsync(id);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete screenshot ${id}:`, error);
        errorCount++;
      }
    }

    if (errorCount === 0) {
      toast.success(`Deleted ${successCount} screenshot(s)`);
    } else {
      toast.warning(`Deleted ${successCount}, failed ${errorCount}`);
    }

    setSelectedScreenshots(new Set());
    refetch();
  }, [selectedScreenshots, deleteScreenshot, refetch]);

  // Get screenshot image URL
  const getImageUrl = (filepath: string) => {
    // In development, screenshots are served from port 34116
    // In production, they're served from the app
    if (filepath.startsWith('/')) {
      // Extract relative path from full path
      const match = filepath.match(/screenshots[/\\](.+)$/);
      if (match) {
        return `/screenshots/${match[1]}`;
      }
    }
    return filepath;
  };

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screenshots</h1>
          <p className="text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextDay}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by window title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterHour} onValueChange={setFilterHour}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by hour" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hours</SelectItem>
              {uniqueHours.map((hour) => (
                <SelectItem key={hour} value={String(hour)}>
                  {hour === 0
                    ? '12 AM'
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? '12 PM'
                    : `${hour - 12} PM`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterApp} onValueChange={setFilterApp}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by app" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Apps</SelectItem>
              {uniqueApps.map((app) => (
                <SelectItem key={app} value={app}>
                  {app}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection Actions */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredScreenshots.length} screenshots
          </span>
          {selectedScreenshots.size > 0 ? (
            <>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Clear ({selectedScreenshots.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
          )}
        </div>
      </div>

      {/* Screenshots Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredScreenshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Image className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg">No screenshots found</p>
          <p className="text-sm">
            {searchQuery || filterApp !== 'all'
              ? 'Try adjusting your filters'
              : 'Screenshots captured today will appear here'}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-4">
            {filteredScreenshots.map((screenshot) => {
              const isSelected = selectedScreenshots.has(screenshot.id);
              const appName = extractString(screenshot.appName) || 'Unknown';
              const windowTitle = extractString(screenshot.windowTitle);

              return (
                <Card
                  key={screenshot.id}
                  className={cn(
                    'group relative cursor-pointer transition-all hover:ring-2 hover:ring-primary/50',
                    isSelected && 'ring-2 ring-primary'
                  )}
                  onClick={() => setPreviewScreenshot(screenshot)}
                >
                  <CardContent className="p-0">
                    {/* Selection indicator */}
                    <div
                      className={cn(
                        'absolute top-2 left-2 z-10 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-background/80 border-muted-foreground/50 opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScreenshot(screenshot.id);
                      }}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>

                    {/* Preview Button */}
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewScreenshot(screenshot);
                        }}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                      <img
                        src={getImageUrl(screenshot.filepath)}
                        alt={windowTitle || 'Screenshot'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="p-2 space-y-0.5">
                      <p className="text-xs font-medium truncate">{appName}</p>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-muted-foreground">
                          {formatTime(screenshot.timestamp)}
                        </p>
                        {screenshot.sessionId && (
                          <span className="text-xs text-muted-foreground font-mono" title={`Session #${screenshot.sessionId}`}>
                            S{screenshot.sessionId}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewScreenshot} onOpenChange={() => setPreviewScreenshot(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {previewScreenshot && (
                <span className="flex items-center gap-2">
                  {extractString(previewScreenshot.appName) || 'Screenshot'}
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatTime(previewScreenshot.timestamp)}
                  </span>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewScreenshot && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg overflow-hidden">
                <img
                  src={getImageUrl(previewScreenshot.filepath)}
                  alt="Screenshot preview"
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
              {extractString(previewScreenshot.windowTitle) && (
                <p className="text-sm text-muted-foreground">
                  {extractString(previewScreenshot.windowTitle)}
                </p>
              )}
              {previewScreenshot.sessionId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-3">
                  <span className="font-medium">Session:</span>
                  <span className="px-2 py-1 bg-muted rounded-md font-mono text-xs">
                    #{previewScreenshot.sessionId}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      // Navigate to Timeline page and open session details
                      window.location.hash = `/timeline?session=${previewScreenshot.sessionId}`;
                    }}
                  >
                    View Session
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    try {
                      await deleteScreenshot.mutateAsync(previewScreenshot.id);
                      toast.success('Screenshot deleted');
                      setPreviewScreenshot(null);
                      refetch();
                    } catch (error) {
                      toast.error('Failed to delete screenshot');
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
