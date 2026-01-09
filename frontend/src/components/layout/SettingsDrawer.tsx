import { useState } from 'react';
import { Database, FolderOpen, HardDrive, Image, Sparkles } from 'lucide-react';
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
import { useConfig, useUpdateConfig, useInferenceStatus, useAvailableModels, useStorageStats, useOpenDataDir, useDataDir, useOptimizeDatabase } from '@/api/hooks';
import { formatBytes } from '@/lib/utils';
import { CategoriesTab } from '@/components/settings/CategoriesTab';
import { GitRepositoriesSection } from '@/components/settings/GitRepositoriesSection';
import { FileWatchDirectoriesSection } from '@/components/settings/FileWatchDirectoriesSection';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const { data: config, isLoading } = useConfig();
  const { data: inferenceStatus } = useInferenceStatus();
  const { data: models } = useAvailableModels();
  const { data: storageStats } = useStorageStats();
  const { data: dataDir } = useDataDir();
  const updateConfig = useUpdateConfig();
  const openDataDir = useOpenDataDir();
  const optimizeDatabase = useOptimizeDatabase();

  const [downloadProgress] = useState<number | null>(null);

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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
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
        <Tabs defaultValue="capture" className="mt-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="capture" className="flex-shrink-0">Capture</TabsTrigger>
            <TabsTrigger value="ai" className="flex-shrink-0">AI</TabsTrigger>
            <TabsTrigger value="categories" className="flex-shrink-0">Categories</TabsTrigger>
            <TabsTrigger value="sources" className="flex-shrink-0">Sources</TabsTrigger>
            <TabsTrigger value="system" className="flex-shrink-0">System</TabsTrigger>
          </TabsList>

          <TabsContent value="capture" className="space-y-6 mt-4">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Image Quality</label>
                <span className="text-sm text-muted-foreground">
                  {config.capture.quality}%
                </span>
              </div>
              <div className="flex gap-2 mb-2">
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
              <p className="text-xs text-muted-foreground">
                Low (~30KB), Medium (~60KB), High (~100KB per screenshot)
              </p>
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
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
          </TabsContent>

          <TabsContent value="ai" className="space-y-6 mt-4">
            <div className="space-y-2">
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
                <div className="space-y-2">
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
                      {models?.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} ({formatBytes(model.size)})
                          {model.downloaded && ' - Downloaded'}
                        </SelectItem>
                      ))}
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

                {inferenceStatus && (
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {inferenceStatus.available
                        ? `Running: ${inferenceStatus.model}`
                        : inferenceStatus.error || 'Not available'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {config.inference.engine === 'ollama' && (
              <div className="space-y-4">
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                <div className="space-y-2">
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

          <TabsContent value="sources" className="space-y-6 mt-4">
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
              <div className="pl-4 border-l-2 border-muted space-y-3">
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
              <div className="pl-4 border-l-2 border-muted">
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
              <div className="pl-4 border-l-2 border-muted">
                <FileWatchDirectoriesSection />
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
          </TabsContent>

          <TabsContent value="categories" className="space-y-6 mt-4">
            <CategoriesTab />
          </TabsContent>

          <TabsContent value="system" className="space-y-6 mt-4">
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

            <div className="space-y-2">
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

            <div className="pt-4 space-y-2">
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
