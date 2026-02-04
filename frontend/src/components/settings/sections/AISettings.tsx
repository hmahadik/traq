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
import { OllamaSetupWizard } from '../OllamaSetupWizard';

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
              <SelectItem value="ollama">Ollama (Recommended)</SelectItem>
              <SelectItem value="bundled">Bundled</SelectItem>
              <SelectItem value="cloud">Cloud API</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        {inference.engine === 'ollama' && (
          <div className="space-y-4 pt-2">
            <OllamaSetupWizard />

            <div className="space-y-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground font-medium">Advanced Settings</p>
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
                  placeholder="qwen2.5:7b"
                />
              </SettingsRow>
            </div>
          </div>
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
            {models
              ?.slice()
              .sort((a, b) => {
                if (a.downloaded !== b.downloaded) return a.downloaded ? -1 : 1;
                return a.size - b.size;
              })
              .map((model) => {
                const isActive = inference.bundled.model === model.id;
                const isRecommended = model.id === 'qwen2.5-3b-q4';
                return (
                  <div
                    key={model.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium truncate">{model.name}</p>
                        {isRecommended && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            Recommended
                          </span>
                        )}
                        {isActive && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {model.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span>Size: {formatBytes(model.size)}</span>
                        <span>
                          Speed: {model.size < 1_000_000_000 ? 'Ultra fast' : model.size < 1_800_000_000 ? 'Fast' : model.size < 2_600_000_000 ? 'Balanced' : 'Thorough'}
                        </span>
                        <span>
                          RAM: {model.size < 1_000_000_000 ? '2-4GB' : model.size < 1_800_000_000 ? '4-6GB' : model.size < 2_600_000_000 ? '6-8GB' : '8-12GB'}
                        </span>
                      </div>
                      {isDownloading && downloadingModelId === model.id && downloadProgress !== null && (
                        <div className="space-y-1">
                          <Progress value={downloadProgress} />
                          <p className="text-xs text-muted-foreground">
                            Downloading... {downloadProgress}%
                          </p>
                        </div>
                      )}
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
                );
              })}
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

      <SettingsCard title="AI Behavior" description="Control how AI features work">
        <SettingsRow
          label="AI Summaries"
          description="How AI-generated summaries are handled"
        >
          <Select
            value={config.ai?.summaryMode || 'drafts'}
            onValueChange={(value) =>
              updateConfig.mutate({
                ai: { ...config.ai, summaryMode: value as 'auto_accept' | 'drafts' | 'off' },
              })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_accept">Auto-accept</SelectItem>
              <SelectItem value="drafts">Show as drafts</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Summary Chunk Size"
          description="Time period for each AI summary"
        >
          <Select
            value={String(config.ai?.summaryChunkMinutes || 15)}
            onValueChange={(value) =>
              updateConfig.mutate({
                ai: { ...config.ai, summaryChunkMinutes: parseInt(value, 10) },
              })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Project Assignment"
          description="How auto-assigned projects are handled"
        >
          <Select
            value={config.ai?.assignmentMode || 'drafts'}
            onValueChange={(value) =>
              updateConfig.mutate({
                ai: { ...config.ai, assignmentMode: value as 'auto_accept' | 'drafts' | 'off' },
              })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_accept">Auto-accept</SelectItem>
              <SelectItem value="drafts">Show as drafts</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <strong>Drafts mode:</strong> AI suggestions appear with a visual indicator and
          require your approval before being committed. This gives you full control over
          AI-generated content.
        </div>
      </SettingsCard>
    </div>
  );
}
