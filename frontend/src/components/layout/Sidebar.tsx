import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, BarChart3, FileText, Settings, Camera, Loader2, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { system } from '@/api/client';

const navItems = [
  { to: '/', label: 'Timeline', icon: Calendar },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
];

interface SidebarProps {
  onSettingsClick: () => void;
}

export function Sidebar({ onSettingsClick }: SidebarProps) {
  const location = useLocation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <Link to="/" className="flex flex-col items-center">
          <span className="font-bold text-lg">Traq</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to || (to === '/' && location.pathname === '/timeline');
            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-2 mx-2 rounded-lg text-xs font-medium transition-colors duration-75',
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
      <div className="py-4 border-t border-border space-y-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex flex-col items-center gap-1 h-auto py-2 transition-colors duration-75"
                onClick={handleForceCapture}
                disabled={isCapturing}
                aria-label="Force Capture"
              >
                {isCapturing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <span className="text-xs font-medium">Capture</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Capture screenshot now</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          className="w-full flex flex-col items-center gap-1 h-auto py-2 transition-colors duration-75"
          onClick={() => {
            onSettingsClick();
            setMobileMenuOpen(false);
          }}
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs font-medium">Settings</span>
        </Button>
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
      <aside className="hidden lg:flex lg:flex-col lg:w-20 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 bg-background border-r border-border">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar - slide in */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-20 bg-background border-r border-border flex flex-col transform transition-transform duration-200 ease-in-out lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
