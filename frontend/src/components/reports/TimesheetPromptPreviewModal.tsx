import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { service } from '@wailsjs/go/models';

const PREAMBLE =
  'Write a single concise paragraph (max 80 words) summarizing the work done on the project below, suitable for a professional agency timesheet entry. Use plain text only — no markdown, no bullets, no headers. Lead with the substantive accomplishment, not the project name. If the data is too sparse to justify a paragraph, write one short sentence.';

interface CollapsibleSectionProps {
  label: string;
  items: string[];
}

function CollapsibleSection({ label, items }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {label} ({items.length})
      </button>
      {open && (
        <ul className="mt-1 ml-4 space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-foreground/80 leading-snug">
              — {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PromptCardProps {
  preview: service.TimesheetPromptPreview;
}

function PromptCard({ preview }: PromptCardProps) {
  const [showFull, setShowFull] = useState(false);
  const isEmpty =
    preview.aiSummaries.length === 0 &&
    preview.gitCommits.length === 0 &&
    preview.windowTitles.length === 0;
  const showWindowTitles =
    preview.windowTitles.length > 0 &&
    preview.aiSummaries.length === 0 &&
    preview.gitCommits.length === 0;

  return (
    <div className="border rounded-md p-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {preview.project}
          <span className="text-muted-foreground font-normal">
            {' '}· {preview.date} · {preview.hours.toFixed(2)} hrs
          </span>
        </span>
        {isEmpty && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            sparse data
          </span>
        )}
      </div>

      {preview.aiSummaries.length > 0 && (
        <CollapsibleSection label="Session Summaries" items={preview.aiSummaries} />
      )}
      {preview.gitCommits.length > 0 && (
        <CollapsibleSection label="Git Commits" items={preview.gitCommits} />
      )}
      {showWindowTitles && (
        <CollapsibleSection label="Window Titles (fallback)" items={preview.windowTitles} />
      )}

      <button
        onClick={() => setShowFull((s) => !s)}
        className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
      >
        {showFull ? 'Hide full prompt' : 'Show full prompt'}
      </button>
      {showFull && (
        <pre className="mt-1 text-xs bg-muted rounded p-2 whitespace-pre-wrap font-mono leading-relaxed">
          {preview.fullPrompt}
        </pre>
      )}
    </div>
  );
}

interface TimesheetPromptPreviewModalProps {
  open: boolean;
  previews: service.TimesheetPromptPreview[];
  backendName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TimesheetPromptPreviewModal({
  open,
  previews,
  backendName,
  onConfirm,
  onCancel,
}: TimesheetPromptPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="text-base">
            Review Prompts
            <span className="text-muted-foreground font-normal text-sm">
              {' '}· {previews.length} {previews.length === 1 ? 'row' : 'rows'} · Sending to: {backendName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Instruction sent with every prompt:</p>
            <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap font-mono leading-relaxed text-muted-foreground">
              {PREAMBLE}
            </pre>
          </div>

          <div className="space-y-3">
            {previews.map((p, i) => (
              <PromptCard key={`${p.date}-${p.project}-${i}`} preview={p} />
            ))}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Generate Notes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
