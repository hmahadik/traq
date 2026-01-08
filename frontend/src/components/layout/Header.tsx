import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, BarChart3, FileText, Settings, Camera, Loader2 } from 'lucide-react';
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

interface HeaderProps {
  onSettingsClick: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  const location = useLocation();
  const [isCapturing, setIsCapturing] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">Traq</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to || (to === '/' && location.pathname === '/timeline');
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex items-center gap-2 transition-colors hover:text-foreground/80 pb-1 border-b-2',
                    isActive
                      ? 'text-foreground border-primary'
                      : 'text-foreground/60 border-transparent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2 pr-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleForceCapture}
                  disabled={isCapturing}
                  aria-label="Force Capture"
                >
                  {isCapturing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Capture screenshot now</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
