import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  QuickPresets,
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
import { api } from '@/api/client';
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

  const handleQuickGenerate = async (
    quickTimeRange: string,
    quickReportType: 'summary' | 'detailed' | 'standup'
  ) => {
    // Update the form state to reflect what's being generated
    setTimeRange(quickTimeRange);
    setReportType(quickReportType);
    // Generate the report
    const result = await generateReport.mutateAsync({
      timeRange: quickTimeRange,
      reportType: quickReportType,
    });
    setGeneratedReport(result);
  };

  const handleExport = async (format: 'md' | 'html' | 'pdf' | 'json') => {
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
      }
    } catch (error) {
      console.error('Failed to load report:', error);
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
          <QuickPresets
            onGenerate={handleQuickGenerate}
            isGenerating={generateReport.isPending}
          />

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
