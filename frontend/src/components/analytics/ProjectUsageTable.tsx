import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { service } from '@/wailsjs/go/models';

interface ProjectUsageTableProps {
  data: service.ProjectUsage[] | undefined;
  isLoading: boolean;
  onProjectClick?: (projectId: number) => void;
}

type SortKey = 'projectName' | 'durationSeconds' | 'focusCount' | 'percentage';
type SortOrder = 'asc' | 'desc';

export function ProjectUsageTable({ data, isLoading, onProjectClick }: ProjectUsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('durationSeconds');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedData = data?.slice().sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No project data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-2 font-medium"
                    onClick={() => handleSort('projectName')}
                  >
                    Project
                    <SortIcon columnKey="projectName" />
                  </Button>
                </th>
                <th className="text-right py-2 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 font-medium"
                    onClick={() => handleSort('durationSeconds')}
                  >
                    Duration
                    <SortIcon columnKey="durationSeconds" />
                  </Button>
                </th>
                <th className="text-right py-2 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 font-medium"
                    onClick={() => handleSort('focusCount')}
                  >
                    Focuses
                    <SortIcon columnKey="focusCount" />
                  </Button>
                </th>
                <th className="text-right py-2 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 font-medium"
                    onClick={() => handleSort('percentage')}
                  >
                    Share
                    <SortIcon columnKey="percentage" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData?.map((project) => (
                <tr
                  key={project.projectId}
                  className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => onProjectClick?.(project.projectId)}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.projectColor }}
                      />
                      <span className="font-medium">{project.projectName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right font-medium">
                    {formatDuration(project.durationSeconds)}
                  </td>
                  <td className="py-3 px-2 text-right text-muted-foreground">
                    {project.focusCount}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(project.percentage, 100)}%`,
                            backgroundColor: project.projectColor,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-10 text-right">
                        {project.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
