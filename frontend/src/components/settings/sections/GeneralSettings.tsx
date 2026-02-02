import { Database, FolderOpen, Image, Sparkles, Clock } from 'lucide-react';
import { AVAILABLE_COLUMNS } from '@/types/timeline';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useConfig,
  useUpdateConfig,
  useStorageStats,
  useOpenDataDir,
  useDataDir,
  useOptimizeDatabase,
  useVersion,
} from '@/api/hooks';
import { formatBytes } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';

export function GeneralSettings() {
  const { data: config, isLoading } = useConfig();
  const { data: storageStats } = useStorageStats();
  const { data: dataDir } = useDataDir();
  const { data: version } = useVersion();
  const updateConfig = useUpdateConfig();
  const openDataDir = useOpenDataDir();
  const optimizeDatabase = useOptimizeDatabase();

  const handleOptimizeDatabase = async () => {
    try {
      const bytesReclaimed = await optimizeDatabase.mutateAsync();
      if (bytesReclaimed > 0) {
        toast.success('Database optimized', {
          description: `Reclaimed ${formatBytes(bytesReclaimed)} of space`,
        });
      } else {
        toast.success('Database optimized', {
          description: 'Database is already optimized',
        });
      }
    } catch (error) {
      toast.error('Failed to optimize database', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleOpenDataDir = async () => {
    try {
      await openDataDir.mutateAsync();
      toast.success('Opened data directory');
    } catch (error) {
      toast.error('Failed to open data directory', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="Appearance">
        <SettingsRow label="Theme" description="Choose your preferred color scheme">
          <Select
            value={config.ui.theme}
            onValueChange={(value: 'light' | 'dark' | 'system') =>
              updateConfig.mutate({
                ui: { ...config.ui, theme: value },
              })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Timeline">
        <SettingsRow
          label="Noise Cancellation"
          description="Filter out brief window switches to reduce visual clutter"
        >
          <Select
            value={String(config.timeline?.minActivityDurationSeconds || 0)}
            onValueChange={(value) =>
              updateConfig.mutate({
                timeline: {
                  ...config.timeline,
                  minActivityDurationSeconds: parseInt(value, 10),
                },
              })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Off</SelectItem>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="60">1 minute</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label="Activity Detail Level"
          description="How much information to show in activity blocks"
        >
          <Select
            value={config.timeline?.titleDisplay || 'full'}
            onValueChange={(value) =>
              updateConfig.mutate({
                timeline: { ...config.timeline, titleDisplay: value as 'full' | 'app_only' | 'minimal' },
              })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Detail</SelectItem>
              <SelectItem value="app_only">App Only</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label="App Grouping"
          description="Merge consecutive activities from the same app"
        >
          <Switch
            checked={config.timeline?.appGrouping || false}
            onCheckedChange={(checked) =>
              updateConfig.mutate({
                timeline: { ...config.timeline, appGrouping: checked },
              })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="Continuity Threshold"
          description="Merge activities separated by brief context switches"
        >
          <Select
            value={String(config.timeline?.continuityMergeSeconds || 0)}
            onValueChange={(value) =>
              updateConfig.mutate({
                timeline: { ...config.timeline, continuityMergeSeconds: parseInt(value, 10) },
              })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Off</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
              <SelectItem value="120">2 min</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label="Visible Columns"
          description="Choose which columns to show in the timeline"
          vertical
        >
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_COLUMNS.map((col) => (
              <label key={col.id} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={config.timeline?.visibleColumns?.includes(col.id) ?? true}
                  onCheckedChange={(checked) => {
                    const current = config.timeline?.visibleColumns || AVAILABLE_COLUMNS.map(c => c.id);
                    const next = checked
                      ? [...current, col.id]
                      : current.filter(c => c !== col.id);
                    updateConfig.mutate({
                      timeline: { ...config.timeline, visibleColumns: next },
                    });
                  }}
                />
                <span className="text-sm">{col.label}</span>
              </label>
            ))}
          </div>
        </SettingsRow>
        <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            When enabled, activities shorter than the threshold will be hidden from the timeline.
            This helps focus on meaningful work blocks rather than brief context switches.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard title="Behavior">
        <SettingsRow
          label="Start on Login"
          description="Launch Traq when you log in"
        >
          <Switch
            checked={config.system.startOnLogin}
            onCheckedChange={(startOnLogin) =>
              updateConfig.mutate({
                system: { ...config.system, startOnLogin },
              })
            }
          />
        </SettingsRow>

        <SettingsRow
          label="Show Notifications"
          description="Display desktop notifications"
        >
          <Switch
            checked={config.ui.showNotifications}
            onCheckedChange={(showNotifications) =>
              updateConfig.mutate({
                ui: { ...config.ui, showNotifications },
              })
            }
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Storage">
        {storageStats ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                Database
              </div>
              <span className="text-sm font-medium">
                {formatBytes(storageStats.databaseSize || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image className="h-4 w-4" />
                Screenshots
              </div>
              <span className="text-sm font-medium">
                {formatBytes(storageStats.screenshotsSize || 0)}
              </span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-sm font-bold">
                {formatBytes((storageStats.databaseSize || 0) + (storageStats.screenshotsSize || 0))}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading storage stats...</div>
        )}

        {dataDir && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Data Directory</p>
            <p className="text-xs font-mono break-all">{dataDir}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleOpenDataDir}
            disabled={openDataDir.isPending}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Open Folder
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleOptimizeDatabase}
            disabled={optimizeDatabase.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {optimizeDatabase.isPending ? 'Optimizing...' : 'Optimize'}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Privacy & Data">
        <SettingsRow
          label="Crash Reporting"
          description="Help improve Traq by sending anonymous crash reports"
        >
          <Switch
            checked={config.issues?.crashReportingEnabled !== false}
            onCheckedChange={(enabled) =>
              updateConfig.mutate({
                issues: { ...config.issues, crashReportingEnabled: enabled },
              })
            }
          />
        </SettingsRow>

        <div className="space-y-2 pt-2">
          <Button variant="outline" className="w-full">
            Export Data
          </Button>
          <Button variant="destructive" className="w-full">
            Clear All Data
          </Button>
        </div>

        <div className="pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>Version {version || 'dev'}</span>
          <a
            href="https://github.com/hmahadik/traq/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Release Notes
          </a>
        </div>
      </SettingsCard>
    </div>
  );
}
