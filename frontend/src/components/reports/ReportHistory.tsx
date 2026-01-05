import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Download,
  MoreVertical,
  Trash2,
  Eye,
  History,
} from 'lucide-react';
import type { ReportMeta } from '@/types';

interface ReportHistoryProps {
  reports: ReportMeta[] | undefined;
  isLoading: boolean;
  onView: (reportId: number) => void;
  onExport: (reportId: number, format: string) => void;
  onDelete: (reportId: number) => void;
}

const FORMAT_COLORS: Record<string, string> = {
  md: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  html: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  pdf: 'bg-red-500/10 text-red-600 dark:text-red-400',
  json: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const TYPE_LABELS: Record<string, string> = {
  summary: 'Summary',
  detailed: 'Detailed',
  standup: 'Standup',
};

export function ReportHistory({
  reports,
  isLoading,
  onView,
  onExport,
  onDelete,
}: ReportHistoryProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Report History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Report History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-50" />
          <p>No reports generated yet</p>
          <p className="text-sm mt-1">Generate a report to see it here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Report History
          <Badge variant="secondary" className="ml-auto">
            {reports.length} reports
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-accent/50 ${
                  selectedId === report.id ? 'bg-accent' : ''
                }`}
                onClick={() => setSelectedId(report.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{report.title}</p>
                      <Badge variant="outline" className="flex-shrink-0">
                        {TYPE_LABELS[report.reportType] || report.reportType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground truncate">
                        {report.timeRange}
                      </p>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge className={FORMAT_COLORS[report.format] || ''}>
                    {report.format.toUpperCase()}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(report.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onExport(report.id, 'md')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export as Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExport(report.id, 'html')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export as HTML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExport(report.id, 'pdf')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(report.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
