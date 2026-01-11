import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDuration } from '@/lib/utils';
import {
  FileText,
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';
import type { Report } from '@/types';

interface ReportPreviewProps {
  report: Report | undefined;
  isLoading: boolean;
  onExport: (format: 'md' | 'html' | 'pdf' | 'json') => void;
  isExporting?: boolean;
}

export function ReportPreview({ report, isLoading, onExport, isExporting }: ReportPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');

  const handleCopy = async () => {
    if (!report || !report.content) return;
    await navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Card className={expanded ? 'fixed inset-4 z-50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Report...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px]">
          <div className="text-center text-muted-foreground">
            <p>Analyzing activity data...</p>
            <p className="text-sm mt-2">This may take a few moments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-50" />
          <p>Generate a report to see preview</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={expanded ? 'fixed inset-4 z-50 overflow-hidden' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>{report.title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {report.timeRange} • Generated in {formatDuration(1)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'rendered' | 'raw')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rendered">Rendered</TabsTrigger>
            <TabsTrigger value="raw">Raw Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="rendered" className="mt-3">
            <ScrollArea className={expanded ? 'h-[calc(100vh-280px)]' : 'h-[400px]'}>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <RenderedMarkdown content={report.content} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="mt-3">
            <ScrollArea className={expanded ? 'h-[calc(100vh-280px)]' : 'h-[400px]'}>
              <pre className="text-sm font-mono whitespace-pre-wrap bg-muted p-4 rounded-lg">
                {report.content}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Export Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </>
            )}
          </Button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">Export as:</span>
          {(['md', 'html', 'pdf', 'json'] as const).map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              onClick={() => onExport(format)}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Simple markdown renderer (basic implementation)
function RenderedMarkdown({ content }: { content: string | null }) {
  if (!content) return null;
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let inTable = false;
  let tableRows: string[] = [];

  const flushTable = (startIndex: number) => {
    if (tableRows.length === 0) return;

    // First row is header, second is separator, rest are data
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(2); // Skip separator row

    // Parse header
    const headers = headerRow
      .split('|')
      .map((h) => h.trim())
      .filter((h) => h);

    // Parse data rows
    const rows = dataRows.map((row) =>
      row
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell)
    );

    elements.push(
      <div key={`table-${startIndex}`} className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-2 text-left font-semibold bg-muted/50"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      if (inTable) flushTable(index);
      if (inCodeBlock) {
        elements.push(
          <pre key={index} className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
            <code>{codeBlockContent.trim()}</code>
          </pre>
        );
        codeBlockContent = '';
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      return;
    }

    // Detect table rows (lines with pipes)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
      }
      tableRows.push(line);
      return;
    } else if (inTable) {
      // End of table
      flushTable(index);
    }

    // Headers - React automatically escapes content in JSX
    if (line.startsWith('# ')) {
      elements.push(<h1 key={index} className="text-2xl font-bold mt-6 mb-4">{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={index} className="text-xl font-semibold mt-5 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>);
    }
    // Lists - React automatically escapes content in JSX
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={index} className="ml-4 list-disc">{line.slice(2)}</li>
      );
    }
    // Numbered lists - React automatically escapes content in JSX
    else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, '');
      elements.push(
        <li key={index} className="ml-4 list-decimal">{text}</li>
      );
    }
    // Horizontal rule
    else if (line === '---' || line === '***') {
      elements.push(<hr key={index} className="my-4" />);
    }
    // Blockquote - React automatically escapes content in JSX
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground">
          {line.slice(2)}
        </blockquote>
      );
    }
    // Bold text handling and regular paragraphs
    else if (line.trim()) {
      // First, escape HTML to prevent XSS
      const escapedLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      // Then apply markdown formatting
      const processedLine = escapedLine
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-sm">$1</code>');
      elements.push(
        <p key={index} className="my-2" dangerouslySetInnerHTML={{ __html: processedLine }} />
      );
    }
  });

  // Flush any remaining table
  if (inTable) flushTable(lines.length);

  return <div className="space-y-1">{elements}</div>;
}
