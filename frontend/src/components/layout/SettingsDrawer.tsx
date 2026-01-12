import { Database, FolderOpen, HardDrive, Image, Monitor, Sparkles, Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useConfig, useUpdateConfig, useInferenceStatus, useAvailableModels, useDownloadModel, useServerStatus, useDownloadServer, useStorageStats, useOpenDataDir, useDataDir, useOptimizeDatabase, useAvailableMonitors, useTestIssueWebhook } from '@/api/hooks';
import { formatBytes } from '@/lib/utils';
import { CategoriesTab } from '@/components/settings/CategoriesTab';
import { TimelineCategoriesTab } from '@/components/settings/TimelineCategoriesTab';
import { GitRepositoriesSection } from '@/components/settings/GitRepositoriesSection';
import { FileWatchDirectoriesSection } from '@/components/settings/FileWatchDirectoriesSection';
import { FileExtensionFilterSection } from '@/components/settings/FileExtensionFilterSection';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const { data: config, isLoading } = useConfig();
  const { data: inferenceStatus } = useInferenceStatus();
  const { data: models } = useAvailableModels();
  const { download: downloadModel, progress: downloadProgress, isDownloading } = useDownloadModel();
  const { data: serverStatus } = useServerStatus();
  const { download: downloadServer, progress: serverDownloadProgress, isDownloading: isDownloadingServer, error: serverDownloadError } = useDownloadServer();
  const { data: storageStats } = useStorageStats();
  const { data: dataDir } = useDataDir();
  const { data: monitors } = useAvailableMonitors();
  const updateConfig = useUpdateConfig();
  const openDataDir = useOpenDataDir();
  const optimizeDatabase = useOptimizeDatabase();
  const testWebhook = useTestIssueWebhook();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure Traq to match your workflow.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !config ? (
          <div className="mt-6 flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        ) : (
        <Tabs defaultValue="capture" className="mt-4 flex flex-col max-h-[calc(85vh-180px)] min-w-0">
          <TabsList className="flex flex-wrap h-auto gap-1.5 p-1.5 flex-shrink-0">
            <TabsTrigger value="capture" className="flex-shrink-0">Capture</TabsTrigger>
            <TabsTrigger value="ai" className="flex-shrink-0">AI</TabsTrigger>
            <TabsTrigger value="categories" className="flex-shrink-0">Categories</TabsTrigger>
            <TabsTrigger value="timeline-categories" className="flex-shrink-0">Timeline Categories</TabsTrigger>
            <TabsTrigger value="sources" className="flex-shrink-0">Sources</TabsTrigger>
            <TabsTrigger value="system" className="flex-shrink-0">System</TabsTrigger>
          </TabsList>

          <TabsContent value="capture" className="space-y-4 mt-4 overflow-y-auto flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Enable Capture</label>
                <p className="text-sm text-muted-foreground">
                  Start capturing screenshots on launch
                </p>
              </div>
              <Switch
                checked={config.capture.enabled}
                onCheckedChange={(enabled) =>
                  updateConfig.mutate({ capture: { ...config.capture, enabled } })
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Capture Interval</label>
                <span className="text-sm text-muted-foreground">
                  {config.capture.intervalSeconds}s
                </span>
              </div>
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
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Image Quality</label>
                <span className="text-sm text-muted-foreground">
                  {config.capture.quality}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Low (~30KB), Medium (~60KB), High (~100KB per screenshot)
              </p>
              <div className="flex gap-2">
                <Button
                  variant={config.capture.quality <= 70 ? "default" : "outline"}
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
                  variant={config.capture.quality > 70 && config.capture.quality <= 85 ? "default" : "outline"}
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
                  variant={config.capture.quality > 85 ? "default" : "outline"}
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
              <Slider
                value={[config.capture.quality]}
                min={60}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  updateConfig.mutate({
                    capture: { ...config.capture, quality: value },
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">AFK Timeout</label>
                <span className="text-sm text-muted-foreground">
                  {Math.floor(config.afk.timeoutSeconds / 60)}m
                </span>
              </div>
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
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Duplicate Threshold</label>
                <span className="text-sm text-muted-foreground">
                  {config.capture.duplicateThreshold}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lower values skip more similar screenshots (1-10)
              </p>
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
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Min Session Duration</label>
                <span className="text-sm text-muted-foreground">
                  {config.afk.minSessionMinutes}m
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Sessions shorter than this won't be saved
              </p>
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
            </div>

            {/* Monitor Selection */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <label className="text-sm font-medium">Monitor Selection</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose which monitor to capture for screenshots
              </p>
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

              {/* Show monitor picker when "specific" is selected */}
              {config.capture.monitorMode === 'specific' && monitors && monitors.length > 0 && (
                <div className="space-y-2 pl-3 border-l-2 border-border">
                  <label className="text-sm font-medium">Select Monitor</label>
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
                </div>
              )}

              {/* Show detected monitors count */}
              {monitors && monitors.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {monitors.length} monitor{monitors.length !== 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 mt-4 overflow-y-auto flex-1 min-w-0">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Inference Engine</label>
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
            </div>

            {config.inference.engine === 'bundled' && (
              <div className="space-y-4">
                {/* Server Binary Status */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
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
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Model</label>
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
                          No models downloaded - download one below
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
                </div>

                {downloadProgress !== null && (
                  <div className="space-y-2">
                    <Progress value={downloadProgress} />
                    <p className="text-sm text-muted-foreground">
                      Downloading model... {downloadProgress}%
                    </p>
                  </div>
                )}

                {/* Available Models for Download */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Available Models</label>
                  <div className="space-y-2">
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
                </div>

                {inferenceStatus && (
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {inferenceStatus.available
                        ? `Running: ${inferenceStatus.model}`
                        : !serverStatus?.installed
                        ? 'Server not installed - click Install Server above'
                        : inferenceStatus.error || 'Not available'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {config.inference.engine === 'ollama' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ollama Host</label>
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
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Model</label>
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
                </div>
                <Button variant="outline" className="w-full">
                  Test Connection
                </Button>
              </div>
            )}

            {config.inference.engine === 'cloud' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Provider</label>
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
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">API Key</label>
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
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Custom API Endpoint</label>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use default endpoint
                  </p>
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
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sources" className="space-y-4 mt-4 overflow-y-auto flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Shell History</label>
                <p className="text-sm text-muted-foreground">
                  Track terminal commands
                </p>
              </div>
              <Switch
                checked={config.dataSources.shell.enabled}
                onCheckedChange={(enabled) =>
                  updateConfig.mutate({
                    dataSources: {
                      ...config.dataSources,
                      shell: { ...config.dataSources.shell, enabled },
                    },
                  })
                }
              />
            </div>

            {/* Shell Type Selection */}
            {config.dataSources.shell.enabled && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Shell Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={config.dataSources.shell.shellType || 'auto'}
                    onChange={(e) =>
                      updateConfig.mutate({
                        dataSources: {
                          ...config.dataSources,
                          shell: { ...config.dataSources.shell, shellType: e.target.value },
                        },
                      })
                    }
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="bash">Bash</option>
                    <option value="zsh">Zsh</option>
                    <option value="fish">Fish</option>
                    <option value="powershell">PowerShell</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Select your shell or use auto-detect
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Custom History Path</label>
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
                    placeholder="Leave empty for auto-detect"
                  />
                  <p className="text-xs text-muted-foreground">
                    Override the default history file path (e.g., ~/.bash_history)
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Exclude Patterns</label>
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
                    placeholder="^npm (install|run)$&#10;^git (status|diff)$&#10;^(cat|less|more) "
                  />
                  <p className="text-xs text-muted-foreground">
                    Regex patterns to exclude commands (one per line). Sensitive commands are always filtered.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Git Activity</label>
                <p className="text-sm text-muted-foreground">
                  Track commits and branches
                </p>
              </div>
              <Switch
                checked={config.dataSources.git.enabled}
                onCheckedChange={(enabled) =>
                  updateConfig.mutate({
                    dataSources: {
                      ...config.dataSources,
                      git: { ...config.dataSources.git, enabled },
                    },
                  })
                }
              />
            </div>

            {/* Git Repository Management */}
            {config.dataSources.git.enabled && (
              <div className="p-3 rounded-lg bg-muted/30">
                <GitRepositoriesSection />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">File Changes</label>
                <p className="text-sm text-muted-foreground">
                  Track file modifications
                </p>
              </div>
              <Switch
                checked={config.dataSources.files.enabled}
                onCheckedChange={(enabled) =>
                  updateConfig.mutate({
                    dataSources: {
                      ...config.dataSources,
                      files: { ...config.dataSources.files, enabled },
                    },
                  })
                }
              />
            </div>

            {/* File Watch Directories Management */}
            {config.dataSources.files.enabled && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-3">
                <FileWatchDirectoriesSection />

                {/* File Extension Filter */}
                <FileExtensionFilterSection />

                {/* Exclude Patterns */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Exclude Patterns</label>
                  <p className="text-xs text-muted-foreground">
                    Directory patterns to exclude from file tracking (one per line)
                  </p>
                  <textarea
                    className="w-full h-24 text-sm p-2 border rounded-md bg-background font-mono resize-y"
                    placeholder="node_modules&#10;.git&#10;__pycache__&#10;.venv"
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
                  <p className="text-xs text-muted-foreground">
                    Default patterns (node_modules, .git, .cache, etc.) are always excluded.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Browser History</label>
                <p className="text-sm text-muted-foreground">
                  Track visited websites
                </p>
              </div>
              <Switch
                checked={config.dataSources.browser.enabled}
                onCheckedChange={(enabled) =>
                  updateConfig.mutate({
                    dataSources: {
                      ...config.dataSources,
                      browser: { ...config.dataSources.browser, enabled },
                    },
                  })
                }
              />
            </div>

            {/* Browser Selection */}
            {config.dataSources.browser.enabled && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Browsers to Track</label>
                  <p className="text-xs text-muted-foreground">
                    Select which browsers to monitor for history
                  </p>
                  <div className="space-y-2">
                    {[
                      { id: 'chrome', label: 'Google Chrome' },
                      { id: 'firefox', label: 'Mozilla Firefox' },
                      { id: 'brave', label: 'Brave' },
                      { id: 'edge', label: 'Microsoft Edge' },
                      { id: 'safari', label: 'Safari' },
                    ].map((browser) => (
                      <label
                        key={browser.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
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
                </div>

                {/* History Limit */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">History Limit</label>
                  <p className="text-xs text-muted-foreground">
                    How far back to read browser history (in days). Set to 0 for unlimited.
                  </p>
                  <select
                    value={config.dataSources.browser.historyLimitDays || 7}
                    onChange={(e) => {
                      updateConfig.mutate({
                        dataSources: {
                          ...config.dataSources,
                          browser: { ...config.dataSources.browser, historyLimitDays: parseInt(e.target.value) },
                        },
                      });
                    }}
                    className="w-full p-2 text-sm rounded-md border bg-background"
                  >
                    <option value={0}>Unlimited</option>
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>

                {/* Excluded Domains */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Excluded Domains</label>
                  <p className="text-xs text-muted-foreground">
                    Domains to exclude from tracking (one per line)
                  </p>
                  <textarea
                    className="w-full min-h-[80px] text-sm p-2 border rounded-md bg-background font-mono resize-y"
                    placeholder="facebook.com&#10;twitter.com&#10;instagram.com"
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
                  <p className="text-xs text-muted-foreground">
                    Also excludes subdomains (e.g., "example.com" excludes "www.example.com")
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4 mt-4 overflow-y-auto flex-1 min-w-0">
            <CategoriesTab />
          </TabsContent>

          <TabsContent value="timeline-categories" className="space-y-4 mt-4 overflow-y-auto flex-1 min-w-0">
            <TimelineCategoriesTab />
          </TabsContent>

          <TabsContent value="system" className="space-y-4 mt-4 overflow-y-auto flex-1 min-w-0">
            {/* Storage Statistics */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Storage
              </label>
              {storageStats ? (
                <div className="rounded-lg bg-muted p-4 space-y-3">
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
                <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  Loading storage stats...
                </div>
              )}
              {/* Data Directory Path */}
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
                  Open Data Directory
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
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Theme</label>
              <Select
                value={config.ui.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') =>
                  updateConfig.mutate({
                    ui: { ...config.ui, theme: value },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Start on Login</label>
                <p className="text-sm text-muted-foreground">
                  Launch Traq when you log in
                </p>
              </div>
              <Switch
                checked={config.system.startOnLogin}
                onCheckedChange={(startOnLogin) =>
                  updateConfig.mutate({
                    system: { ...config.system, startOnLogin },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Show Notifications</label>
                <p className="text-sm text-muted-foreground">
                  Display desktop notifications
                </p>
              </div>
              <Switch
                checked={config.ui.showNotifications}
                onCheckedChange={(showNotifications) =>
                  updateConfig.mutate({
                    ui: { ...config.ui, showNotifications },
                  })
                }
              />
            </div>

            {/* Crash Report Webhook */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <label className="text-sm font-medium">Crash Report Notifications</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Get notified when the app crashes via webhook (Slack, Discord, Teams, etc.)
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable webhook</span>
                <Switch
                  checked={config.issues?.webhookEnabled || false}
                  onCheckedChange={(enabled) =>
                    updateConfig.mutate({
                      issues: { ...config.issues, webhookEnabled: enabled },
                    })
                  }
                />
              </div>
              {(config.issues?.webhookEnabled || false) && (
                <div className="space-y-2">
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={config.issues?.webhookUrl || ''}
                    onChange={(e) =>
                      updateConfig.mutate({
                        issues: { ...config.issues, webhookUrl: e.target.value },
                      })
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => testWebhook.mutate()}
                    disabled={testWebhook.isPending || !config.issues?.webhookUrl}
                  >
                    {testWebhook.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Test Notification'
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button variant="outline" className="w-full">
                Export Data
              </Button>
              <Button variant="destructive" className="w-full">
                Clear All Data
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
