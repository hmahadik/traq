import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { useConfig, useUpdateConfig, useInferenceStatus, useAvailableModels } from '@/api/hooks';
import { formatBytes } from '@/lib/utils';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const { data: config } = useConfig();
  const { data: inferenceStatus } = useInferenceStatus();
  const { data: models } = useAvailableModels();
  const updateConfig = useUpdateConfig();

  const [downloadProgress] = useState<number | null>(null);

  if (!config) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure Traq to match your workflow.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="capture" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="capture">Capture</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
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

          <TabsContent value="system" className="space-y-6 mt-4">
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
      </SheetContent>
    </Sheet>
  );
}
