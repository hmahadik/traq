import { ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfig, useUpdateConfig } from '@/api/hooks';
import { SettingsRow } from '../SettingsRow';
import { GitRepositoriesSection } from '../GitRepositoriesSection';
import { FileWatchDirectoriesSection } from '../FileWatchDirectoriesSection';
import { FileExtensionFilterSection } from '../FileExtensionFilterSection';

interface CollapsibleCardProps {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleCard({ title, enabled, onToggle, children }: CollapsibleCardProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          {enabled ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <h3 className="text-base font-medium">{title}</h3>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && (
        <div className="px-4 pb-4 pt-0 border-t space-y-4">
          <div className="pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function DataSourcesSettings() {
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <CollapsibleCard
        title="Shell History"
        enabled={config.dataSources.shell.enabled}
        onToggle={(enabled) =>
          updateConfig.mutate({
            dataSources: {
              ...config.dataSources,
              shell: { ...config.dataSources.shell, enabled },
            },
          })
        }
      >
        <SettingsRow label="Shell Type" vertical>
          <Select
            value={config.dataSources.shell.shellType || 'auto'}
            onValueChange={(value) =>
              updateConfig.mutate({
                dataSources: {
                  ...config.dataSources,
                  shell: { ...config.dataSources.shell, shellType: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="bash">Bash</SelectItem>
              <SelectItem value="zsh">Zsh</SelectItem>
              <SelectItem value="fish">Fish</SelectItem>
              <SelectItem value="powershell">PowerShell</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow label="Custom History Path" description="Leave empty for auto-detect" vertical>
          <Input
            value={config.dataSources.shell.historyPath || ''}
            onChange={(e) =>
              updateConfig.mutate({
                dataSources: {
                  ...config.dataSources,
                  shell: { ...config.dataSources.shell, historyPath: e.target.value },
                },
              })
            }
            placeholder="~/.bash_history"
          />
        </SettingsRow>

        <SettingsRow label="Exclude Patterns" description="Regex patterns to exclude (one per line)" vertical>
          <textarea
            className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono resize-y"
            value={(config.dataSources.shell.excludePatterns || []).join('\n')}
            onChange={(e) => {
              const patterns = e.target.value
                .split('\n')
                .map((p) => p.trim())
                .filter((p) => p.length > 0);
              updateConfig.mutate({
                dataSources: {
                  ...config.dataSources,
                  shell: { ...config.dataSources.shell, excludePatterns: patterns },
                },
              });
            }}
            placeholder="^npm (install|run)$&#10;^git (status|diff)$"
          />
        </SettingsRow>
      </CollapsibleCard>

      <CollapsibleCard
        title="Git Activity"
        enabled={config.dataSources.git.enabled}
        onToggle={(enabled) =>
          updateConfig.mutate({
            dataSources: {
              ...config.dataSources,
              git: { ...config.dataSources.git, enabled },
            },
          })
        }
      >
        <GitRepositoriesSection />
      </CollapsibleCard>

      <CollapsibleCard
        title="File Changes"
        enabled={config.dataSources.files.enabled}
        onToggle={(enabled) =>
          updateConfig.mutate({
            dataSources: {
              ...config.dataSources,
              files: { ...config.dataSources.files, enabled },
            },
          })
        }
      >
        <FileWatchDirectoriesSection />
        <FileExtensionFilterSection />

        <SettingsRow label="Exclude Patterns" description="Directory patterns to exclude (one per line)" vertical>
          <textarea
            className="w-full h-24 text-sm p-2 border rounded-md bg-background font-mono resize-y"
            placeholder="node_modules&#10;.git&#10;__pycache__"
            value={(config.dataSources.files.excludePatterns || []).join('\n')}
            onChange={(e) => {
              const patterns = e.target.value
                .split('\n')
                .map((p) => p.trim())
                .filter((p) => p.length > 0);
              updateConfig.mutate({
                dataSources: {
                  ...config.dataSources,
                  files: { ...config.dataSources.files, excludePatterns: patterns },
                },
              });
            }}
          />
        </SettingsRow>
      </CollapsibleCard>

      <CollapsibleCard
        title="Browser History"
        enabled={config.dataSources.browser.enabled}
        onToggle={(enabled) =>
          updateConfig.mutate({
            dataSources: {
              ...config.dataSources,
              browser: { ...config.dataSources.browser, enabled },
            },
          })
        }
      >
        <SettingsRow label="Browsers to Track" vertical>
          <div className="space-y-2">
            {[
              { id: 'chrome', label: 'Google Chrome' },
              { id: 'firefox', label: 'Mozilla Firefox' },
              { id: 'brave', label: 'Brave' },
              { id: 'edge', label: 'Microsoft Edge' },
              { id: 'safari', label: 'Safari' },
            ].map((browser) => (
              <label key={browser.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={(config.dataSources.browser.browsers || []).includes(browser.id)}
                  onChange={(e) => {
                    const currentBrowsers = config.dataSources.browser.browsers || [];
                    const newBrowsers = e.target.checked
                      ? [...currentBrowsers, browser.id]
                      : currentBrowsers.filter((b) => b !== browser.id);
                    updateConfig.mutate({
                      dataSources: {
                        ...config.dataSources,
                        browser: { ...config.dataSources.browser, browsers: newBrowsers },
                      },
                    });
                  }}
                />
                <span className="text-sm">{browser.label}</span>
              </label>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow label="History Limit" vertical>
          <Select
            value={String(config.dataSources.browser.historyLimitDays || 7)}
            onValueChange={(value) => {
              updateConfig.mutate({
                dataSources: {
                  ...config.dataSources,
                  browser: { ...config.dataSources.browser, historyLimitDays: parseInt(value) },
                },
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Unlimited</SelectItem>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow label="Excluded Domains" description="Domains to exclude (one per line)" vertical>
          <textarea
            className="w-full min-h-[80px] text-sm p-2 border rounded-md bg-background font-mono resize-y"
            placeholder="facebook.com&#10;twitter.com"
            value={(config.dataSources.browser.excludedDomains || []).join('\n')}
            onChange={(e) => {
              const domains = e.target.value
                .split('\n')
                .map((d) => d.trim())
                .filter((d) => d.length > 0);
              updateConfig.mutate({
                dataSources: {
                  ...config.dataSources,
                  browser: { ...config.dataSources.browser, excludedDomains: domains },
                },
              });
            }}
          />
        </SettingsRow>
      </CollapsibleCard>
    </div>
  );
}
