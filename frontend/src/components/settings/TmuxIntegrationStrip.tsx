import { useTmuxSetupStatus, useInstallTmuxIntegration, useUninstallTmuxIntegration } from '@/api/hooks';
import { Button } from '@/components/ui/button';

const stateLabels: Record<string, { pill: string; className: string }> = {
  not_installed:   { pill: 'Not installed',   className: 'bg-muted text-muted-foreground' },
  active:          { pill: 'Active',          className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  needs_attention: { pill: 'Needs attention', className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
};

export function TmuxIntegrationStrip() {
  const { data: status, isLoading } = useTmuxSetupStatus();
  const install = useInstallTmuxIntegration();
  const uninstall = useUninstallTmuxIntegration();

  if (isLoading || !status) return null;

  const label = stateLabels[status.state] ?? stateLabels.not_installed;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Tmux integration</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${label.className}`}>
            {label.pill}
          </span>
        </div>
        <div className="flex gap-2">
          {(status.state === 'not_installed' || status.state === 'needs_attention') && status.installed && (
            <Button size="sm" onClick={() => install.mutate()} disabled={install.isPending}>
              {status.state === 'needs_attention' ? 'Reinstall' : 'Install'}
            </Button>
          )}
          {status.state === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => uninstall.mutate()}
              disabled={uninstall.isPending}
            >
              Uninstall
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Adds a small block to your tmux config that sets the terminal window title from the active
        pane's title. Without this, every tmux focus event arrives in Traq with the same generic
        terminal title — with it, each pane's working directory flows through, so Traq's project
        attribution can tell the difference between time spent in different repos in different panes.
      </p>
      {status.confPath && (
        <p className="text-xs text-muted-foreground">
          Writes to <code className="rounded bg-muted px-1">{status.confPath}</code> inside a
          managed fenced block — your other tmux settings are left alone.
        </p>
      )}
      {status.message && <p className="text-xs text-muted-foreground">{status.message}</p>}
      {status.state === 'active' && (
        <p className="text-xs text-muted-foreground">
          Open a new tmux session, or run <code className="rounded bg-muted px-1">tmux source-file {status.confPath}</code>{' '}
          to apply in existing sessions.
        </p>
      )}
    </div>
  );
}
