import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, PieChart, ClipboardList, Camera, Image, Loader2, Menu, X, Pause, Play, Settings, Bug, FolderKanban } from 'lucide-react';
import logoSrc from '@/assets/logo-minimal.svg';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { system, api } from '@/api/client';
import { ReportIssueDialog } from '@/components/common/ReportIssueDialog';

const navItems = [
  { to: '/', label: 'Timeline', icon: Clock },
  { to: '/analytics', label: 'Analytics', icon: PieChart },
  { to: '/screenshots', label: 'Screenshots', icon: Image },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

export function Sidebar() {
  const location = useLocation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Fetch initial pause state and poll for updates
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await api.getDaemonStatus();
        setIsPaused(status.paused);
      } catch (error) {
        // Ignore errors during status fetch
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleTogglePause = async () => {
    try {
      if (isPaused) {
        await api.config.resumeCapture();
        setIsPaused(false);
        toast.success('Capture resumed', {
          description: 'Screenshot capture is now active',
        });
      } else {
        await api.config.pauseCapture();
        setIsPaused(true);
        toast.success('Capture paused', {
          description: 'Screenshot capture is temporarily paused',
        });
      }
    } catch (error) {
      toast.error('Failed to toggle pause', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleForceCapture = async () => {
    if (isCapturing) return;

    setIsCapturing(true);
    try {
      const filepath = await system.forceCapture();
      if (filepath) {
        toast.success('Screenshot captured', {
          description: 'A new screenshot has been saved',
        });
      } else {
        toast.info('Screenshot skipped', {
          description: 'Screenshot was a duplicate or capture is paused',
        });
      }
    } catch (error) {
      toast.error('Capture failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="py-4 border-b border-border">
        <Link to="/" className="flex flex-col items-center gap-1">
          <img src={logoSrc} alt="Traq" className="h-10 w-10" />
          <span className="font-semibold text-xs text-muted-foreground">Traq</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        <ul className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive =
              location.pathname === to ||
              (to === '/' && location.pathname === '/timeline') ||
              (to !== '/' && location.pathname.startsWith(to + '/'));
            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-colors duration-75',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Actions */}
      <div className="py-4 px-2 border-t border-border space-y-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "w-full flex flex-col items-center gap-1 h-auto py-3 rounded-lg text-xs font-medium transition-colors duration-75",
                  isPaused
                    ? "text-yellow-500 hover:bg-muted hover:text-yellow-600"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={handleTogglePause}
                aria-label={isPaused ? 'Resume Capture' : 'Pause Capture'}
              >
                {isPaused ? (
                  <Play className="h-5 w-5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isPaused ? 'Resume screenshot capture' : 'Pause screenshot capture'}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "w-full flex flex-col items-center gap-1 h-auto py-3 rounded-lg text-xs font-medium transition-colors duration-75",
                  isCapturing || isPaused
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={handleForceCapture}
                disabled={isCapturing || isPaused}
                aria-label="Force Capture"
              >
                {isCapturing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <span>Capture</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isPaused ? 'Resume capture first' : 'Capture screenshot now'}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="w-full flex flex-col items-center gap-1 h-auto py-3 rounded-lg text-xs font-medium transition-colors duration-75 text-orange-500 hover:bg-muted hover:text-orange-600"
                onClick={() => {
                  setReportDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
                aria-label="Report Issue"
              >
                <Bug className="h-5 w-5" />
                <span>Report</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Report an issue or bug</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                className={cn(
                  'w-full flex flex-col items-center gap-1 h-auto py-3 rounded-lg transition-colors duration-75',
                  location.pathname.startsWith('/settings')
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="h-5 w-5" />
                <span className="text-xs font-medium">Settings</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop sidebar - always visible */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[100px] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 bg-background border-r border-border">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar - slide in */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[100px] bg-background border-r border-border flex flex-col transform transition-transform duration-200 ease-in-out lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Report Issue Dialog */}
      <ReportIssueDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </>
  );
}
