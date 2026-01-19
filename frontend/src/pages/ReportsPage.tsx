import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TimeRangeSelector,
  ReportTypeSelector,
  ReportPreview,
} from '@/components/reports';
import {
  useReportHistory,
  useGenerateReport,
  useExportReport,
  useDeleteReport,
  useParseTimeRange,
  useProjects,
} from '@/api/hooks';
import { api } from '@/api/client';
import { Loader2, Sparkles, ImageIcon, History, Trash2, FolderKanban } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Report, ReportMeta } from '@/types';
import { useDateContext } from '@/contexts';

function formatDateForTimeRange(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

export function ReportsPage() {
  const { selectedDate, timeframeType, dateRange, setSelectedDate, setTimeframeType, setDateRange } = useDateContext();

  const getInitialTimeRange = () => {
    if (timeframeType === 'day') {
      const today = new Date();
      const isToday = selectedDate.toDateString() === today.toDateString();
      if (isToday) return 'Today';

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = selectedDate.toDateString() === yesterday.toDateString();
      if (isYesterday) return 'Yesterday';

      return formatDateForTimeRange(selectedDate);
    }

    if (dateRange) {
      return `${formatDateForTimeRange(dateRange.start)} - ${formatDateForTimeRange(dateRange.end)}`;
    }

    return 'Today';
  };

  const [timeRange, setTimeRange] = useState(getInitialTimeRange());

  useEffect(() => {
    setTimeRange(getInitialTimeRange());
  }, [selectedDate, timeframeType, dateRange]);

  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'standup'>('summary');
  const [includeScreenshots, setIncludeScreenshots] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<Report | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const { data: history } = useReportHistory();
  const { data: projects } = useProjects();
  const { data: parsedRange } = useParseTimeRange(timeRange);
  const generateReport = useGenerateReport();
  const exportReport = useExportReport();
  const deleteReport = useDeleteReport();

  const handleGenerate = async () => {
    const projectId = selectedProjectId === 'all' ? 0 : parseInt(selectedProjectId, 10);
    const result = await generateReport.mutateAsync({ timeRange, reportType, includeScreenshots, projectId });
    setGeneratedReport(result);
  };

  const handleExport = async (format: 'html' | 'markdown') => {
    if (!generatedReport) return;
    await exportReport.mutateAsync({ reportId: generatedReport.id, format });
  };

  const handleViewReport = async (reportId: number) => {
    try {
      const report = await api.reports.getReport(reportId);
      if (report) {
        setGeneratedReport({
          id: report.id,
          title: report.title,
          content: report.content?.String || '',
          timeRange: report.timeRange,
          reportType: report.reportType as 'summary' | 'detailed' | 'standup',
          format: report.format as 'markdown' | 'html' | 'pdf' | 'json',
          createdAt: report.createdAt,
          filepath: report.filepath?.String || null,
          startTime: report.startTime?.Int64 || null,
          endTime: report.endTime?.Int64 || null,
        });

        if (report.startTime?.Int64 && report.endTime?.Int64) {
          const startDate = new Date(report.startTime.Int64 * 1000);
          const endDate = new Date(report.endTime.Int64 * 1000);
          const isSameDay = startDate.toDateString() === endDate.toDateString();

          if (isSameDay) {
            setSelectedDate(startDate);
            setTimeframeType('day');
            setDateRange(null);
          } else {
            setDateRange({ start: startDate, end: endDate });
            setTimeframeType('custom');
            setSelectedDate(endDate);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    }
  };

  const handleDeleteReport = async (reportId: number) => {
    try {
      await deleteReport.mutateAsync(reportId);
      if (generatedReport?.id === reportId) {
        setGeneratedReport(undefined);
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Reports</h1>

        {/* History dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-2" />
              History
              {history && history.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {history.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Previous Reports</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!history || history.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No reports yet
              </div>
            ) : (
              history.slice(0, 10).map((report: ReportMeta) => (
                <DropdownMenuItem
                  key={report.id}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => handleViewReport(report.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{report.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.timeRange} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-2 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteReport(report.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main content - fills remaining height */}
      <div className="flex-1 grid gap-6 lg:grid-cols-[340px_1fr] min-h-0">
        {/* Left Column - Configuration */}
        <div className="space-y-4 lg:overflow-y-auto">
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            parsedRange={parsedRange}
          />

          <ReportTypeSelector value={reportType} onChange={setReportType} />

          {/* Project filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
              Project Filter
            </label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects (combined)</SelectItem>
                {projects?.map(project => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="includeScreenshots"
                checked={includeScreenshots}
                onCheckedChange={setIncludeScreenshots}
              />
              <label htmlFor="includeScreenshots" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Include screenshots
              </label>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateReport.isPending}
              className="w-full"
            >
              {generateReport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Preview (fills height) */}
        <ReportPreview
          report={generatedReport}
          isLoading={generateReport.isPending}
          onExport={handleExport}
          isExporting={exportReport.isPending}
          fullHeight
        />
      </div>
    </div>
  );
}
