import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Pencil, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectActivities, useBulkAssignProject, useProjects } from '@/api/hooks';
import type { Project } from '@/api/client';

interface ProjectActivitiesTabProps {
  project: Project;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function ProjectActivitiesTab({ project }: ProjectActivitiesTabProps) {
  const [dateRange, setDateRange] = useState('7'); // days
  const [reassigning, setReassigning] = useState<number | null>(null);

  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

  const { data: activities, isLoading } = useProjectActivities(project.id, startDate, endDate);
  const { data: allProjects } = useProjects();
  const bulkAssign = useBulkAssignProject();

  const handleReassign = async (activity: { eventType: string; eventId: number }, newProjectId: number) => {
    await bulkAssign.mutateAsync([{
      eventType: activity.eventType,
      eventId: activity.eventId,
      projectId: newProjectId,
    }]);
    setReassigning(null);
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading activities...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {activities?.length || 0} activities
        </span>
      </div>

      <div className="border rounded-lg divide-y">
        {activities?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No activities in this time range
          </div>
        ) : (
          activities?.map((activity) => (
            <div
              key={`${activity.eventType}-${activity.eventId}`}
              className="p-3 flex items-center gap-3 hover:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {activity.appName}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {activity.windowTitle}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDuration(activity.durationSeconds)}
              </div>

              <Badge variant="outline" className="text-xs">
                {activity.source}
              </Badge>

              {reassigning === activity.eventId ? (
                <Select
                  onValueChange={(v) => handleReassign(activity, parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Move to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unassigned</SelectItem>
                    {allProjects?.filter(p => p.id !== project.id).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReassigning(activity.eventId)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
