# Settings UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the modal-based Settings UI with a dedicated `/settings` page featuring sidebar navigation and clean card-based layout.

**Architecture:** Full page at `/settings` with left sidebar nav (5 sections) and scrollable content area. Each section is a separate component with grouped settings in cards. Settings state managed via existing `useConfig` hook.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Radix UI components (existing), React Router (hash routing)

---

## Task 1: Create SettingsCard Component

**Files:**
- Create: `frontend/src/components/settings/SettingsCard.tsx`

**Step 1: Create the SettingsCard component**

```tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ title, description, children, className }: SettingsCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-4 pb-4 border-b">
        <h3 className="text-base font-medium">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/SettingsCard.tsx
git commit -m "feat(settings): add SettingsCard component"
```

---

## Task 2: Create SettingsRow Component

**Files:**
- Create: `frontend/src/components/settings/SettingsRow.tsx`

**Step 1: Create the SettingsRow component**

```tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  vertical?: boolean;
}

export function SettingsRow({ label, description, children, className, vertical = false }: SettingsRowProps) {
  if (vertical) {
    return (
      <div className={cn('space-y-2', className)}>
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex-1 min-w-0">
        <label className="text-sm font-medium">{label}</label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/SettingsRow.tsx
git commit -m "feat(settings): add SettingsRow component"
```

---

## Task 3: Create SettingsSidebar Component

**Files:**
- Create: `frontend/src/components/settings/SettingsSidebar.tsx`

**Step 1: Create the sidebar component**

```tsx
import { Link, useLocation } from 'react-router-dom';
import { Camera, Database, Sparkles, Tags, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVersion } from '@/api/hooks';

const sections = [
  { path: '/settings/capture', label: 'Capture', icon: Camera },
  { path: '/settings/data-sources', label: 'Data Sources', icon: Database },
  { path: '/settings/ai', label: 'AI', icon: Sparkles },
  { path: '/settings/categories', label: 'Categories', icon: Tags },
  { path: '/settings/general', label: 'General', icon: Settings2 },
];

export function SettingsSidebar() {
  const location = useLocation();
  const { data: version } = useVersion();

  return (
    <aside className="w-52 flex-shrink-0 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {sections.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path ||
              (path === '/settings/capture' && location.pathname === '/settings');
            return (
              <li key={path}>
                <Link
                  to={path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        v{version || 'dev'}
      </div>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/SettingsSidebar.tsx
git commit -m "feat(settings): add SettingsSidebar component"
```

---

## Task 4: Create CaptureSettings Section

**Files:**
- Create: `frontend/src/components/settings/sections/CaptureSettings.tsx`

**Step 1: Create the capture settings section**

Extract capture-related settings from SettingsDrawer.tsx into a standalone component.

```tsx
import { Monitor } from 'lucide-react';
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
          description={`${Math.floor(config.afk.timeoutSeconds / 60)} minutes of inactivity`}
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
          description={`Sessions shorter than ${config.afk.minSessionMinutes} minutes won't be saved`}
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
```

**Step 2: Create sections directory and commit**

```bash
mkdir -p frontend/src/components/settings/sections
git add frontend/src/components/settings/sections/CaptureSettings.tsx
git commit -m "feat(settings): add CaptureSettings section"
```

---

## Task 5: Create DataSourcesSettings Section

**Files:**
- Create: `frontend/src/components/settings/sections/DataSourcesSettings.tsx`

**Step 1: Create the data sources settings section**

```tsx
import { useState } from 'react';
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
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { GitRepositoriesSection } from '../GitRepositoriesSection';
import { FileWatchDirectoriesSection } from '../FileWatchDirectoriesSection';
import { FileExtensionFilterSection } from '../FileExtensionFilterSection';
import { cn } from '@/lib/utils';

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
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/sections/DataSourcesSettings.tsx
git commit -m "feat(settings): add DataSourcesSettings section"
```

---

## Task 6: Create AISettings Section

**Files:**
- Create: `frontend/src/components/settings/sections/AISettings.tsx`

**Step 1: Create the AI settings section**

```tsx
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  useInferenceStatus,
  useAvailableModels,
  useDownloadModel,
  useServerStatus,
  useDownloadServer,
} from '@/api/hooks';
import { formatBytes } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';

export function AISettings() {
  const { data: config, isLoading } = useConfig();
  const { data: inferenceStatus } = useInferenceStatus();
  const { data: models } = useAvailableModels();
  const { download: downloadModel, progress: downloadProgress, isDownloading } = useDownloadModel();
  const { data: serverStatus } = useServerStatus();
  const { download: downloadServer, progress: serverDownloadProgress, isDownloading: isDownloadingServer, error: serverDownloadError } = useDownloadServer();
  const updateConfig = useUpdateConfig();

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="Inference Engine" description="Choose how AI features are powered">
        <SettingsRow label="Engine" vertical>
          <Select
            value={config.inference.engine}
            onValueChange={(value: 'bundled' | 'ollama' | 'cloud') =>
              updateConfig.mutate({
                inference: { ...config.inference, engine: value },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bundled">Bundled (Recommended)</SelectItem>
              <SelectItem value="ollama">External Ollama</SelectItem>
              <SelectItem value="cloud">Cloud API</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        {config.inference.engine === 'ollama' && (
          <>
            <SettingsRow label="Ollama Host" vertical>
              <Input
                value={config.inference.ollama.host}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...config.inference,
                      ollama: { ...config.inference.ollama, host: e.target.value },
                    },
                  })
                }
                placeholder="http://localhost:11434"
              />
            </SettingsRow>
            <SettingsRow label="Model" vertical>
              <Input
                value={config.inference.ollama.model}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...config.inference,
                      ollama: { ...config.inference.ollama, model: e.target.value },
                    },
                  })
                }
                placeholder="gemma3:12b-it-qat"
              />
            </SettingsRow>
            <Button variant="outline" className="w-full">
              Test Connection
            </Button>
          </>
        )}

        {config.inference.engine === 'cloud' && (
          <>
            <SettingsRow label="Provider" vertical>
              <Select
                value={config.inference.cloud.provider}
                onValueChange={(value: 'anthropic' | 'openai') =>
                  updateConfig.mutate({
                    inference: {
                      ...config.inference,
                      cloud: { ...config.inference.cloud, provider: value },
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
            <SettingsRow label="API Key" vertical>
              <Input
                type="password"
                value={config.inference.cloud.apiKey}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...config.inference,
                      cloud: { ...config.inference.cloud, apiKey: e.target.value },
                    },
                  })
                }
                placeholder="sk-..."
              />
            </SettingsRow>
            <SettingsRow label="Custom Endpoint" description="Leave empty for default" vertical>
              <Input
                value={config.inference.cloud.endpoint || ''}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...config.inference,
                      cloud: { ...config.inference.cloud, endpoint: e.target.value },
                    },
                  })
                }
                placeholder="https://api.example.com/v1"
              />
            </SettingsRow>
          </>
        )}
      </SettingsCard>

      {config.inference.engine === 'bundled' && (
        <SettingsCard title="Model Management">
          {/* Server Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Inference Server</p>
              <p className="text-xs text-muted-foreground">
                llama.cpp server {serverStatus?.version || ''}
              </p>
            </div>
            {serverStatus?.installed ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Installed
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isDownloadingServer}
                onClick={downloadServer}
              >
                {isDownloadingServer ? 'Installing...' : 'Install Server'}
              </Button>
            )}
          </div>

          {serverDownloadProgress !== null && (
            <div className="space-y-1">
              <Progress value={serverDownloadProgress} />
              <p className="text-xs text-muted-foreground">
                Downloading server... {serverDownloadProgress}%
              </p>
            </div>
          )}
          {serverDownloadError && (
            <p className="text-xs text-red-500">{serverDownloadError}</p>
          )}

          {/* Model Selection */}
          <SettingsRow label="Active Model" vertical>
            <Select
              value={config.inference.bundled.model}
              onValueChange={(value) =>
                updateConfig.mutate({
                  inference: {
                    ...config.inference,
                    bundled: { model: value },
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models?.filter((m) => m.downloaded).length === 0 ? (
                  <SelectItem value="none" disabled>
                    No models downloaded
                  </SelectItem>
                ) : (
                  models?.filter((m) => m.downloaded).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({formatBytes(model.size)})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </SettingsRow>

          {downloadProgress !== null && (
            <div className="space-y-2">
              <Progress value={downloadProgress} />
              <p className="text-sm text-muted-foreground">
                Downloading model... {downloadProgress}%
              </p>
            </div>
          )}

          {/* Available Models */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Available Models</label>
            {models?.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{model.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {model.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(model.size)}
                  </p>
                </div>
                <div className="ml-3">
                  {model.downloaded ? (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Downloaded
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDownloading}
                      onClick={() => downloadModel(model.id)}
                    >
                      Download
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Status */}
          {inferenceStatus && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground">
                {inferenceStatus.available
                  ? `Running: ${inferenceStatus.model}`
                  : !serverStatus?.installed
                  ? 'Server not installed'
                  : inferenceStatus.error || 'Not available'}
              </p>
            </div>
          )}
        </SettingsCard>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/sections/AISettings.tsx
git commit -m "feat(settings): add AISettings section"
```

---

## Task 7: Create CategoriesSettings Section

**Files:**
- Create: `frontend/src/components/settings/sections/CategoriesSettings.tsx`

**Step 1: Create the categories settings section**

This reuses the existing CategoriesTab and TimelineCategoriesTab components.

```tsx
import { SettingsCard } from '../SettingsCard';
import { CategoriesTab } from '../CategoriesTab';
import { TimelineCategoriesTab } from '../TimelineCategoriesTab';

export function CategoriesSettings() {
  return (
    <div className="space-y-6">
      <SettingsCard
        title="App Categories"
        description="Categorize apps to calculate productivity scores in analytics"
      >
        <CategoriesTab />
      </SettingsCard>

      <SettingsCard
        title="Timeline Categories"
        description="Customize how activities are grouped in the timeline"
      >
        <TimelineCategoriesTab />
      </SettingsCard>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/sections/CategoriesSettings.tsx
git commit -m "feat(settings): add CategoriesSettings section"
```

---

## Task 8: Create GeneralSettings Section

**Files:**
- Create: `frontend/src/components/settings/sections/GeneralSettings.tsx`

**Step 1: Create the general settings section**

```tsx
import { Database, FolderOpen, HardDrive, Image, Sparkles, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
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
            href="https://github.com/hmahadik/activity-tracker/releases"
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
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "feat(settings): add GeneralSettings section"
```

---

## Task 9: Create Section Index Export

**Files:**
- Create: `frontend/src/components/settings/sections/index.ts`

**Step 1: Create index file**

```tsx
export { CaptureSettings } from './CaptureSettings';
export { DataSourcesSettings } from './DataSourcesSettings';
export { AISettings } from './AISettings';
export { CategoriesSettings } from './CategoriesSettings';
export { GeneralSettings } from './GeneralSettings';
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/sections/index.ts
git commit -m "feat(settings): add sections index export"
```

---

## Task 10: Update SettingsPage with New Layout

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

**Step 1: Replace the redirect-only page with the new layout**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import {
  CaptureSettings,
  DataSourcesSettings,
  AISettings,
  CategoriesSettings,
  GeneralSettings,
} from '@/components/settings/sections';

export function SettingsPage() {
  return (
    <div className="h-full flex -mx-4 sm:-mx-6 -my-6">
      <SettingsSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-6">
          <Routes>
            <Route index element={<Navigate to="capture" replace />} />
            <Route path="capture" element={<CaptureSettings />} />
            <Route path="data-sources" element={<DataSourcesSettings />} />
            <Route path="ai" element={<AISettings />} />
            <Route path="categories" element={<CategoriesSettings />} />
            <Route path="general" element={<GeneralSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat(settings): implement new SettingsPage layout"
```

---

## Task 11: Update Router for Nested Settings Routes

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Update the router to handle nested settings routes**

Change the settings route from:
```tsx
{ path: 'settings', element: <SettingsPage /> },
```

To:
```tsx
{ path: 'settings/*', element: <SettingsPage /> },
```

**Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(settings): update router for nested settings routes"
```

---

## Task 12: Update Sidebar to Link to Settings Page

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: Change settings button to a link**

Replace the settings button (around line 195-213) with a Link:

```tsx
<Link
  to="/settings"
  className={cn(
    'w-full flex flex-col items-center gap-1 h-auto py-2 transition-colors duration-75',
    location.pathname.startsWith('/settings')
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground'
  )}
  onClick={() => setMobileMenuOpen(false)}
>
  <Settings className="h-5 w-5" />
  <span className="text-xs font-medium">Settings</span>
</Link>
```

Also remove the `onSettingsClick` prop since it's no longer needed.

**Step 2: Remove onSettingsClick prop from interface**

Remove the `SidebarProps` interface and `onSettingsClick` prop handling.

**Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(settings): update Sidebar to link to settings page"
```

---

## Task 13: Update AppLayout to Remove Modal

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Step 1: Remove SettingsDrawer and related state**

Update AppLayout to remove the modal:

```tsx
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { Sidebar } from './Sidebar';
import { DateProvider } from '@/contexts';
import { GlobalErrorHandler } from '@/components/common/GlobalErrorHandler';

export function AppLayout() {
  useTheme();

  return (
    <DateProvider>
      <GlobalErrorHandler>
        <div className="relative h-screen bg-background overflow-hidden">
          <Sidebar />
          {/* Main content - offset by sidebar width on desktop */}
          <main className="lg:pl-[88px] h-screen flex flex-col">
            <div className="flex-1 px-4 sm:px-6 py-6 min-h-0 overflow-hidden">
              <Outlet />
            </div>
          </main>
          <Toaster position="bottom-right" />
        </div>
      </GlobalErrorHandler>
    </DateProvider>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx
git commit -m "refactor(settings): remove SettingsDrawer from AppLayout"
```

---

## Task 14: Delete SettingsDrawer Component

**Files:**
- Delete: `frontend/src/components/layout/SettingsDrawer.tsx`

**Step 1: Delete the file**

```bash
rm frontend/src/components/layout/SettingsDrawer.tsx
```

**Step 2: Update layout index if needed**

Check if `frontend/src/components/layout/index.ts` exports SettingsDrawer and remove that export.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(settings): delete SettingsDrawer component"
```

---

## Task 15: Update Settings Component Index

**Files:**
- Modify: `frontend/src/components/settings/` - ensure proper exports

**Step 1: Create or update settings index**

Create `frontend/src/components/settings/index.ts`:

```tsx
export { SettingsCard } from './SettingsCard';
export { SettingsRow } from './SettingsRow';
export { SettingsSidebar } from './SettingsSidebar';
export { CategoriesTab } from './CategoriesTab';
export { TimelineCategoriesTab } from './TimelineCategoriesTab';
export { GitRepositoriesSection } from './GitRepositoriesSection';
export { FileWatchDirectoriesSection } from './FileWatchDirectoriesSection';
export { FileExtensionFilterSection } from './FileExtensionFilterSection';
```

**Step 2: Commit**

```bash
git add frontend/src/components/settings/index.ts
git commit -m "feat(settings): add settings component index"
```

---

## Task 16: Manual Testing Checklist

**Files:** None (manual verification)

**Step 1: Start the dev server**

```bash
cd /home/harshad/projects/traq/.worktrees/settings-redesign
wails dev -tags webkit2_41
```

**Step 2: Verify all sections work**

- [ ] Navigate to `/settings` - should redirect to `/settings/capture`
- [ ] Capture section: all sliders, toggles, and selects work
- [ ] Data Sources section: all toggles expand/collapse, settings persist
- [ ] AI section: engine switch works, model download works
- [ ] Categories section: app search and category assignment work
- [ ] General section: theme switch works, storage stats display

**Step 3: Verify navigation**

- [ ] Sidebar link navigates to settings
- [ ] Settings sidebar highlights active section
- [ ] Deep links work (e.g., `/settings/ai` goes directly to AI section)
- [ ] Back/forward browser navigation works

**Step 4: Verify no regressions**

- [ ] No console errors
- [ ] All settings persist after page reload
- [ ] Modal no longer appears anywhere

---

## Task 17: Final Commit and Cleanup

**Files:** None

**Step 1: Run tests**

```bash
cd frontend && npm test
```

**Step 2: If all tests pass, create final summary commit**

```bash
git log --oneline -15
```

Review the commits to ensure they're clean.
