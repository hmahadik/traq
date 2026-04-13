import { RefreshCw, Download, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  useUpdateStatus,
  useCheckForUpdate,
  useTriggerUpdate,
  useSetUpdateEnabled,
} from '@/api/hooks';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';

function formatLastCheck(lastCheck: string): string {
  if (!lastCheck) return 'Never';
  const date = new Date(lastCheck);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export function UpdatesSettings() {
  const { data: status, isLoading } = useUpdateStatus();
  const checkForUpdate = useCheckForUpdate();
  const triggerUpdate = useTriggerUpdate();
  const setEnabled = useSetUpdateEnabled();

  if (isLoading || !status) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="Software Updates">
        <SettingsRow
          label="Current Version"
          description="Installed version of Traq"
        >
          <span className="text-sm font-mono">
            v{status.currentVersion}
          </span>
        </SettingsRow>

        <SettingsRow
          label="Automatic Updates"
          description="Download and install updates automatically when idle"
        >
          <Switch
            checked={status.enabled}
            disabled={setEnabled.isPending}
            onCheckedChange={(checked) => setEnabled.mutate(checked)}
          />
        </SettingsRow>

        <SettingsRow
          label="Last Checked"
          description={formatLastCheck(status.lastCheck)}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkForUpdate.mutate()}
            disabled={checkForUpdate.isPending}
          >
            {checkForUpdate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Check for Updates
          </Button>
        </SettingsRow>
      </SettingsCard>

      {status.updatePending && status.pendingInfo && (
        <SettingsCard title="Update Available">
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  v{status.pendingInfo.version} is ready to install
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Downloaded and staged for installation
                </p>
              </div>
            </div>

            {status.pendingInfo.releaseNotes && (
              <div className="text-xs text-muted-foreground border-t pt-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {status.pendingInfo.releaseNotes.slice(0, 500)}
                {status.pendingInfo.releaseNotes.length > 500 && '...'}
              </div>
            )}

            <Button
              onClick={() => triggerUpdate.mutate()}
              disabled={triggerUpdate.isPending}
              className="w-full"
            >
              {triggerUpdate.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Apply Update & Restart
            </Button>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
