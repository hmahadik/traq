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

  if (isLoading || !config || !config.inference) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const { inference } = config;

  return (
    <div className="space-y-6">
      <SettingsCard title="Inference Engine" description="Choose how AI features are powered">
        <SettingsRow label="Engine" vertical>
          <Select
            value={inference.engine}
            onValueChange={(value: 'bundled' | 'ollama' | 'cloud') =>
              updateConfig.mutate({
                inference: { ...inference, engine: value },
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

        {inference.engine === 'ollama' && (
          <>
            <SettingsRow label="Ollama Host" vertical>
              <Input
                value={inference.ollama.host}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...inference,
                      ollama: { ...inference.ollama, host: e.target.value },
                    },
                  })
                }
                placeholder="http://localhost:11434"
              />
            </SettingsRow>
            <SettingsRow label="Model" vertical>
              <Input
                value={inference.ollama.model}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...inference,
                      ollama: { ...inference.ollama, model: e.target.value },
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

        {inference.engine === 'cloud' && (
          <>
            <SettingsRow label="Provider" vertical>
              <Select
                value={inference.cloud.provider}
                onValueChange={(value: 'anthropic' | 'openai') =>
                  updateConfig.mutate({
                    inference: {
                      ...inference,
                      cloud: { ...inference.cloud, provider: value },
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
                value={inference.cloud.apiKey}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...inference,
                      cloud: { ...inference.cloud, apiKey: e.target.value },
                    },
                  })
                }
                placeholder="sk-..."
              />
            </SettingsRow>
            <SettingsRow label="Custom Endpoint" description="Leave empty for default" vertical>
              <Input
                value={inference.cloud.endpoint || ''}
                onChange={(e) =>
                  updateConfig.mutate({
                    inference: {
                      ...inference,
                      cloud: { ...inference.cloud, endpoint: e.target.value },
                    },
                  })
                }
                placeholder="https://api.example.com/v1"
              />
            </SettingsRow>
          </>
        )}
      </SettingsCard>

      {inference.engine === 'bundled' && (
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
              value={inference.bundled.model}
              onValueChange={(value) =>
                updateConfig.mutate({
                  inference: {
                    ...inference,
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
