import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  TimeRangeSelector,
  ReportTypeSelector,
  ReportPreview,
  ReportHistory,
} from '@/components/reports';
import {
  useReportHistory,
  useGenerateReport,
  useExportReport,
  useParseTimeRange,
} from '@/api/hooks';
import { Loader2, Sparkles } from 'lucide-react';
import type { Report } from '@/types';

export function ReportsPage() {
  const [timeRange, setTimeRange] = useState('today');
  const [reportType, setReportType] = useState('summary');
  const [generatedReport, setGeneratedReport] = useState<Report | undefined>();

  const { data: history, isLoading: historyLoading } = useReportHistory();
  const { data: parsedRange } = useParseTimeRange(timeRange);
  const generateReport = useGenerateReport();
  const exportReport = useExportReport();

  const handleGenerate = async () => {
    const result = await generateReport.mutateAsync({ timeRange, reportType });
    setGeneratedReport(result);
  };

  const handleExport = async (format: 'md' | 'html' | 'pdf' | 'json') => {
    if (!generatedReport) return;
    await exportReport.mutateAsync({ reportId: generatedReport.id, format });
  };

  const handleViewReport = (reportId: number) => {
    const report = history?.find((r) => r.id === reportId);
    if (report) {
      // In a real implementation, this would fetch the full report content
      setGeneratedReport({
        id: report.id,
        title: report.title,
        content: '# Report Content\n\nThis would load the full report content from the backend.',
        timeRange: report.timeRange,
        reportType: report.reportType as 'summary' | 'detailed' | 'standup',
        format: report.format as 'markdown' | 'html' | 'pdf' | 'json',
        createdAt: report.createdAt,
        filepath: null,
        startTime: null,
        endTime: null,
      });
    }
  };

  const handleExportFromHistory = async (reportId: number, format: string) => {
    await exportReport.mutateAsync({ reportId, format });
  };

  const handleDeleteReport = (reportId: number) => {
    // In a real implementation, this would call a delete API
    console.log('Delete report:', reportId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and export activity reports
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left Column - Report Configuration */}
        <div className="space-y-4">
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            parsedRange={parsedRange}
          />

          <ReportTypeSelector value={reportType} onChange={setReportType} />

          <Button
            onClick={handleGenerate}
            disabled={generateReport.isPending}
            className="w-full"
            size="lg"
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

        {/* Right Column - Preview */}
        <ReportPreview
          report={generatedReport}
          isLoading={generateReport.isPending}
          onExport={handleExport}
          isExporting={exportReport.isPending}
        />
      </div>

      {/* Report History */}
      <ReportHistory
        reports={history}
        isLoading={historyLoading}
        onView={handleViewReport}
        onExport={handleExportFromHistory}
        onDelete={handleDeleteReport}
      />
    </div>
  );
}
