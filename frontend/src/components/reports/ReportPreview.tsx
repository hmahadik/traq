import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Copy, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';

interface ReportPreviewProps {
  report: Report | undefined;
  isLoading: boolean;
  onExport: (format: 'html' | 'markdown') => void;
  isExporting?: boolean;
  fullHeight?: boolean;
}

export function ReportPreview({ report, isLoading, onExport, isExporting, fullHeight }: ReportPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!report || !report.content) return;
    await navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardClass = cn(
    fullHeight && 'flex flex-col h-full min-h-0 overflow-hidden'
  );

  const contentClass = cn(
    'flex flex-col',
    fullHeight ? 'flex-1 min-h-0 overflow-hidden' : 'space-y-4'
  );

  if (isLoading) {
    return (
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(contentClass, 'items-center justify-center')}>
          <p className="text-muted-foreground">Analyzing activity data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className={cn(contentClass, 'items-center justify-center text-muted-foreground')}>
          <FileText className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Generate a report to see preview</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 shrink-0">
        <div>
          <CardTitle className="text-base">{report.title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">{report.timeRange}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className={contentClass}>
        <ScrollArea className={fullHeight ? 'flex-1 min-h-0' : 'h-[400px]'}>
          <div
            className="report-content pr-4"
            dangerouslySetInnerHTML={{ __html: report.content || '' }}
          />
        </ScrollArea>

        <div className="flex items-center gap-2 pt-3 border-t mt-auto shrink-0">
          <span className="text-sm text-muted-foreground">Export:</span>
          {(['html', 'markdown'] as const).map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              onClick={() => onExport(format)}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
