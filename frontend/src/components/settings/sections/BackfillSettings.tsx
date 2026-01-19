import { useState } from 'react';
import { Loader2, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import {
  useReportIncludeUnassigned,
  useSetReportIncludeUnassigned,
  useBackfillPreview,
  useBackfillRun,
} from '@/api/hooks';

interface BackfillResult {
  totalProcessed: number;
  autoAssigned: number;
  alreadyAssigned: number;
  noMatch: number;
}

export function BackfillSettings() {
  const { data: includeUnassigned = true } = useReportIncludeUnassigned();
  const setIncludeUnassigned = useSetReportIncludeUnassigned();

  const backfillPreview = useBackfillPreview();
  const backfillRun = useBackfillRun();

  // Date range for backfill (default to last 7 days)
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [previewResult, setPreviewResult] = useState<BackfillResult | null>(null);

  const handlePreview = async () => {
    try {
      const result = await backfillPreview.mutateAsync({
        startDate,
        endDate,
        minConfidence,
      });
      setPreviewResult(result as BackfillResult);
    } catch (error) {
      toast.error('Preview failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleRun = async () => {
    try {
      const result = await backfillRun.mutateAsync({
        startDate,
        endDate,
        minConfidence,
      });
      const assigned = (result as BackfillResult)?.autoAssigned ?? 0;
      toast.success('Backfill complete', {
        description: `Assigned ${assigned} activities to projects`,
      });
      setPreviewResult(null);
    } catch (error) {
      toast.error('Backfill failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Config */}
      <SettingsCard
        title="Report Settings"
        description="Configure how activities appear in generated reports"
      >
        <SettingsRow
          label="Include unassigned activities"
          description="When disabled, only project-assigned activities appear in reports"
        >
          <Switch
            checked={includeUnassigned}
            onCheckedChange={(checked) => setIncludeUnassigned.mutate(checked)}
            disabled={setIncludeUnassigned.isPending}
          />
        </SettingsRow>
      </SettingsCard>

      {/* Backfill */}
      <SettingsCard
        title="Backfill Projects"
        description="Apply project patterns to historical activities that haven't been assigned yet"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="start-date" className="text-sm font-medium">
              Start Date
            </label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="end-date" className="text-sm font-medium">
              End Date
            </label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="min-confidence" className="text-sm font-medium">
            Minimum Confidence: {Math.round(minConfidence * 100)}%
          </label>
          <Input
            id="min-confidence"
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {previewResult && (
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="font-medium">Preview Results:</div>
            <div>Total activities: {previewResult.totalProcessed}</div>
            <div className="text-green-600 dark:text-green-400">
              Would assign: {previewResult.autoAssigned}
            </div>
            <div className="text-muted-foreground">
              Already assigned: {previewResult.alreadyAssigned}
            </div>
            <div className="text-muted-foreground">
              No pattern match: {previewResult.noMatch}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={backfillPreview.isPending}
          >
            {backfillPreview.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Preview
          </Button>
          <Button
            onClick={handleRun}
            disabled={backfillRun.isPending || !previewResult || previewResult.autoAssigned === 0}
          >
            {backfillRun.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Backfill
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
