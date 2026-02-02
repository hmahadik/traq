import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfig, useUpdateConfig, useAvailableMonitors } from '@/api/hooks';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';

export function CaptureSettings() {
  const { data: config, isLoading } = useConfig();
  const { data: monitors } = useAvailableMonitors();
  const updateConfig = useUpdateConfig();

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="Screenshot Capture">
        <SettingsRow
          label="Enable Capture"
          description="Start capturing screenshots on launch"
        >
          <Switch
            checked={config.capture.enabled}
            onCheckedChange={(enabled) =>
              updateConfig.mutate({ capture: { ...config.capture, enabled } })
            }
          />
        </SettingsRow>

        <SettingsRow
          label="Capture Interval"
          description={`Every ${config.capture.intervalSeconds} seconds`}
          vertical
        >
          <Slider
            value={[config.capture.intervalSeconds]}
            min={10}
            max={120}
            step={5}
            onValueChange={([value]) =>
              updateConfig.mutate({
                capture: { ...config.capture, intervalSeconds: value },
              })
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>10s</span>
            <span>120s</span>
          </div>
        </SettingsRow>

        <SettingsRow label="Image Quality" vertical>
          <p className="text-xs text-muted-foreground mb-2">
            Low (~30KB), Medium (~60KB), High (~100KB per screenshot)
          </p>
          <div className="flex gap-2">
            <Button
              variant={config.capture.quality <= 70 ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() =>
                updateConfig.mutate({
                  capture: { ...config.capture, quality: 65 },
                })
              }
            >
              Low
            </Button>
            <Button
              variant={config.capture.quality > 70 && config.capture.quality <= 85 ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() =>
                updateConfig.mutate({
                  capture: { ...config.capture, quality: 80 },
                })
              }
            >
              Medium
            </Button>
            <Button
              variant={config.capture.quality > 85 ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() =>
                updateConfig.mutate({
                  capture: { ...config.capture, quality: 95 },
                })
              }
            >
              High
            </Button>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Duplicate Threshold"
          description={`Skip similar screenshots (currently: ${config.capture.duplicateThreshold})`}
          vertical
        >
          <Slider
            value={[config.capture.duplicateThreshold]}
            min={1}
            max={10}
            step={1}
            onValueChange={([value]) =>
              updateConfig.mutate({
                capture: { ...config.capture, duplicateThreshold: value },
              })
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>More similar</span>
            <span>Less similar</span>
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Monitor Selection" description="Choose which monitor to capture">
        <SettingsRow label="Capture Mode" vertical>
          <Select
            value={config.capture.monitorMode || 'active_window'}
            onValueChange={(value: 'active_window' | 'primary' | 'specific') => {
              updateConfig.mutate({
                capture: { ...config.capture, monitorMode: value },
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active_window">Follow Active Window</SelectItem>
              <SelectItem value="primary">Always Primary Monitor</SelectItem>
              <SelectItem value="specific">Specific Monitor</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        {config.capture.monitorMode === 'specific' && monitors && monitors.length > 0 && (
          <SettingsRow label="Select Monitor" vertical>
            <Select
              value={String(config.capture.monitorIndex || 0)}
              onValueChange={(value) => {
                updateConfig.mutate({
                  capture: { ...config.capture, monitorIndex: parseInt(value) },
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monitors.map((monitor) => (
                  <SelectItem key={monitor.index} value={String(monitor.index)}>
                    {monitor.name} ({monitor.width}x{monitor.height})
                    {monitor.isPrimary && ' - Primary'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        )}

        {monitors && monitors.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {monitors.length} monitor{monitors.length !== 1 ? 's' : ''} detected
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="AFK Detection">
        <SettingsRow
          label="AFK Timeout"
          description={`${Math.floor(config.afk.timeoutSeconds / 60)} ${Math.floor(config.afk.timeoutSeconds / 60) === 1 ? 'minute' : 'minutes'} of inactivity`}
          vertical
        >
          <Slider
            value={[config.afk.timeoutSeconds / 60]}
            min={1}
            max={10}
            step={1}
            onValueChange={([value]) =>
              updateConfig.mutate({
                afk: { ...config.afk, timeoutSeconds: value * 60 },
              })
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1 min</span>
            <span>10 min</span>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Min Session Duration"
          description={`Sessions shorter than ${config.afk.minSessionMinutes} ${config.afk.minSessionMinutes === 1 ? 'minute' : 'minutes'} won't be saved`}
          vertical
        >
          <Slider
            value={[config.afk.minSessionMinutes]}
            min={1}
            max={30}
            step={1}
            onValueChange={([value]) =>
              updateConfig.mutate({
                afk: { ...config.afk, minSessionMinutes: value },
              })
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1 min</span>
            <span>30 min</span>
          </div>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
