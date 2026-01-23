import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Download, ExternalLink, Terminal, Sparkles } from 'lucide-react';
import { GetOllamaSetupStatus, StartOllamaService, PullOllamaModel, GetOllamaInstallInfo, AutoInstallOllama } from '@wailsjs/go/main/App';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';

interface OllamaSetupStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  models: string[];
  recommendedModel: string;
  needsSetup: boolean;
}

interface OllamaInstallInfo {
  command: string;
  url: string;
  canAutoInstall: boolean;
}

interface PullProgress {
  status: string;
  percent: number;
  total?: number;
  completed?: number;
}

export function OllamaSetupWizard({ onComplete }: { onComplete?: () => void }) {
  const [status, setStatus] = useState<OllamaSetupStatus | null>(null);
  const [installInfo, setInstallInfo] = useState<OllamaInstallInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [startingService, setStartingService] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const [s, info] = await Promise.all([
        GetOllamaSetupStatus(),
        GetOllamaInstallInfo()
      ]);
      setStatus(s);
      setInstallInfo(info);
      setLoading(false);
    } catch (err) {
      setError('Failed to check Ollama status');
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Listen for pull progress events
  useEffect(() => {
    const handleProgress = (progress: PullProgress) => {
      setPullProgress(progress);
      if (progress.status === 'success' || progress.percent === 100) {
        setPulling(false);
        checkStatus();
      }
    };

    EventsOn('ollama-pull-progress', handleProgress);
    return () => {
      EventsOff('ollama-pull-progress');
    };
  }, []);

  const handleAutoInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await AutoInstallOllama();
      // Wait a bit for service to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      await checkStatus();
    } catch (err) {
      setError('Installation failed. Try installing manually.');
    } finally {
      setInstalling(false);
    }
  };

  const handleStartService = async () => {
    setStartingService(true);
    setError(null);
    try {
      await StartOllamaService();
      // Wait for service to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      await checkStatus();
    } catch (err) {
      setError('Failed to start Ollama service');
    } finally {
      setStartingService(false);
    }
  };

  const handlePullModel = async () => {
    if (!status?.recommendedModel) return;
    setPulling(true);
    setPullProgress({ status: 'Starting...', percent: 0 });
    setError(null);
    try {
      await PullOllamaModel(status.recommendedModel);
      await checkStatus();
    } catch (err) {
      setError('Failed to pull model');
      setPulling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // All set up!
  if (status && !status.needsSetup) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">AI Ready</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ollama is running with {status.models.length} model{status.models.length !== 1 ? 's' : ''} installed.
          </p>
          {onComplete && (
            <Button onClick={onComplete} className="mt-4" size="sm">
              Continue
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <CardTitle>AI Setup</CardTitle>
        </div>
        <CardDescription>
          Traq uses AI to generate activity summaries. Let's set it up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Install Ollama */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {status?.installed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div>
              <p className="font-medium">1. Install Ollama</p>
              <p className="text-sm text-muted-foreground">
                {status?.installed
                  ? `Installed ${status.version || ''}`
                  : 'Local AI runtime for generating summaries'}
              </p>
            </div>
          </div>

          {!status?.installed && installInfo && (
            <div className="ml-8 space-y-2">
              {installInfo.canAutoInstall ? (
                <Button
                  onClick={handleAutoInstall}
                  disabled={installing}
                  size="sm"
                >
                  {installing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Install Automatically
                    </>
                  )}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <a href={installInfo.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Download Ollama
                  </a>
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Or run: <code className="px-1 py-0.5 bg-muted rounded">{installInfo.command}</code>
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Start Service */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {status?.running ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : status?.installed ? (
              <XCircle className="h-5 w-5 text-orange-500 shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
            )}
            <div>
              <p className="font-medium">2. Start Ollama Service</p>
              <p className="text-sm text-muted-foreground">
                {status?.running
                  ? 'Service is running'
                  : 'Required for AI to work'}
              </p>
            </div>
          </div>

          {status?.installed && !status?.running && (
            <div className="ml-8">
              <Button
                onClick={handleStartService}
                disabled={startingService}
                size="sm"
              >
                {startingService ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Terminal className="h-4 w-4 mr-2" />
                    Start Service
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Step 3: Pull Model */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {status?.models && status.models.length > 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : status?.running ? (
              <XCircle className="h-5 w-5 text-orange-500 shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
            )}
            <div>
              <p className="font-medium">3. Download AI Model</p>
              <p className="text-sm text-muted-foreground">
                {status?.models && status.models.length > 0
                  ? `${status.models.length} model${status.models.length !== 1 ? 's' : ''} available`
                  : `Recommended: ${status?.recommendedModel || 'qwen2.5:7b'} (~4.7GB)`}
              </p>
            </div>
          </div>

          {status?.running && (!status?.models || status.models.length === 0) && (
            <div className="ml-8 space-y-2">
              <Button
                onClick={handlePullModel}
                disabled={pulling}
                size="sm"
              >
                {pulling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download {status.recommendedModel}
                  </>
                )}
              </Button>

              {pulling && pullProgress && (
                <div className="space-y-1">
                  <Progress value={pullProgress.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {pullProgress.status} {pullProgress.percent > 0 && `(${pullProgress.percent}%)`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={checkStatus}>
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
