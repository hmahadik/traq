import { useShellSetupStatus, useInstallShellPlugin, useUninstallShellPlugin } from '@/api/hooks';
import { Button } from '@/components/ui/button';

interface Props {
  shell: string;
}

const stateLabels: Record<string, { pill: string; className: string }> = {
  not_installed:      { pill: 'Not installed',       className: 'bg-muted text-muted-foreground' },
  active:             { pill: 'Active',              className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  installed_disabled: { pill: 'Installed (disabled)', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  needs_attention:    { pill: 'Needs attention',     className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
};

export function ShellIntegrationStrip({ shell }: Props) {
  const { data: status, isLoading } = useShellSetupStatus(shell);
  const install = useInstallShellPlugin();
  const uninstall = useUninstallShellPlugin();

  if (isLoading || !status) return null;

  const label = stateLabels[status.state] ?? stateLabels.not_installed;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Shell integration</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${label.className}`}>
            {label.pill}
          </span>
        </div>
        <div className="flex gap-2">
          {status.state === 'not_installed' && (
            <Button size="sm" onClick={() => install.mutate(shell)} disabled={install.isPending}>
              Install plugin
            </Button>
          )}
          {status.state === 'needs_attention' && (
            <Button size="sm" onClick={() => install.mutate(shell)} disabled={install.isPending}>
              Reinstall
            </Button>
          )}
          {(status.state === 'active' ||
            status.state === 'installed_disabled' ||
            status.state === 'needs_attention') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm('Remove Traq shell integration?')) {
                  uninstall.mutate(shell);
                }
              }}
              disabled={uninstall.isPending}
            >
              Uninstall
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{status.message}</p>
      {status.state === 'active' && (
        <p className="text-xs text-muted-foreground">
          Open a new terminal or run <code className="rounded bg-muted px-1">source {status.rcPath}</code>{' '}
          to activate in existing shells.
        </p>
      )}
    </div>
  );
}
