import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReportHistory, useGenerateReport, useParseTimeRange } from '@/api/hooks';
import { formatDate } from '@/lib/utils';
import { FileText, Download, Loader2 } from 'lucide-react';

export function ReportsPage() {
  const [timeRange, setTimeRange] = useState('today');
  const [reportType, setReportType] = useState('summary');
  const { data: history, isLoading: historyLoading } = useReportHistory();
  const { data: parsedRange } = useParseTimeRange(timeRange);
  const generateReport = useGenerateReport();

  const handleGenerate = () => {
    generateReport.mutate({ timeRange, reportType });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Reports</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Report Generator */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <Input
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                placeholder="today, yesterday, last week, past 3 days..."
              />
              {parsedRange && (
                <p className="text-sm text-muted-foreground">
                  {parsedRange.label}: {formatDate(parsedRange.start)} - {formatDate(parsedRange.end)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="standup">Standup</SelectItem>
                </SelectContent>
              </Select>
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
                'Generate Report'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Report Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {generateReport.data ? (
              <div className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-h-[400px] overflow-auto">
                  <pre className="whitespace-pre-wrap text-sm">
                    {generateReport.data.content}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download MD
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download HTML
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <FileText className="h-12 w-12 mb-4" />
                <p>Generate a report to see preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : history?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No reports generated yet
            </p>
          ) : (
            <div className="space-y-2">
              {history?.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{report.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.timeRange}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{report.format}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </p>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
