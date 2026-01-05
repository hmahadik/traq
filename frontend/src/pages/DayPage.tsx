import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useScreenshotsForHour } from '@/api/hooks';
import { formatDate, formatTimestamp } from '@/lib/utils';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const currentDate = date || new Date().toISOString().split('T')[0];
  const { data: screenshots, isLoading } = useScreenshotsForHour(currentDate, 10); // Example hour

  const goToPreviousDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    navigate(`/day/${d.toISOString().split('T')[0]}`);
  };

  const goToNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    navigate(`/day/${d.toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{formatDate(new Date(currentDate).getTime() / 1000)}</h1>
        <Button variant="ghost" size="icon" onClick={goToNextDay}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Hour Groups */}
      <div className="space-y-4">
        {Array.from({ length: 12 }, (_, i) => i + 8).map((hour) => (
          <Card key={hour}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">
                {hour.toString().padStart(2, '0')}:00 - {(hour + 1).toString().padStart(2, '0')}:00
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              {isLoading ? (
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-video rounded" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {screenshots?.slice(0, 6).map((screenshot) => (
                    <div
                      key={screenshot.id}
                      className="relative aspect-video rounded overflow-hidden bg-muted cursor-pointer hover:ring-2 ring-primary transition-all"
                    >
                      <img
                        src={`https://via.placeholder.com/200x112/1a1a2e/16213e?text=${screenshot.id}`}
                        alt={screenshot.windowTitle || 'Screenshot'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                        <p className="text-[10px] text-white truncate">
                          {formatTimestamp(screenshot.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
