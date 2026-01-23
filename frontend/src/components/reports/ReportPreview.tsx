import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Copy, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';

// Simple markdown to HTML converter for common elements
function markdownToHtml(markdown: string): string {
  let html = markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*)$/gm, '<h3 style="font-size:1.1rem;font-weight:600;margin:1rem 0 0.5rem 0;color:#f1f5f9;">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 style="font-size:1.25rem;font-weight:600;margin:1.5rem 0 0.75rem 0;color:#f1f5f9;border-bottom:1px solid rgba(148,163,184,0.2);padding-bottom:0.5rem;">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 style="font-size:1.5rem;font-weight:700;margin:0 0 1rem 0;color:#f1f5f9;">$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f1f5f9;">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.3);border-radius:6px;padding:12px;font-family:monospace;font-size:0.85rem;color:#94a3b8;overflow-x:auto;margin:1rem 0;"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(249,115,22,0.1);padding:2px 6px;border-radius:4px;color:#f97316;font-size:0.85em;">$1</code>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      const isHeader = cells.some(c => c.trim().match(/^-+$/));
      if (isHeader) return ''; // Skip separator rows
      const cellTag = match.includes('---') ? 'td' : 'td';
      const cellsHtml = cells.map(c => `<${cellTag} style="padding:8px 12px;border-bottom:1px solid rgba(148,163,184,0.1);">${c.trim()}</${cellTag}>`).join('');
      return `<tr>${cellsHtml}</tr>`;
    })
    // Horizontal rules
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(148,163,184,0.2);margin:1.5rem 0;"/>')
    // List items
    .replace(/^- (.*)$/gm, '<li style="margin-bottom:0.25rem;color:#cbd5e1;">$1</li>')
    // Wrap consecutive list items in ul
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="margin:0.5rem 0;padding-left:1.5rem;list-style:disc;">${match}</ul>`)
    // Italic text for footnotes
    .replace(/^\*([^*]+)\*$/gm, '<p style="color:#64748b;font-style:italic;font-size:0.85rem;margin-top:1rem;">$1</p>')
    // Paragraphs - wrap remaining text
    .replace(/^([^<\n].+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p style="margin:0.5rem 0;color:#cbd5e1;">${match}</p>`;
    });

  // Wrap tables
  html = html.replace(/(<tr>[\s\S]*?<\/tr>[\s]*)+/g, (match) => {
    return `<table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin:1rem 0;">${match}</table>`;
  });

  return html;
}

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
